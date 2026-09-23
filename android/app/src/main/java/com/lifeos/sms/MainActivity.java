package com.lifeos.sms;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends AppCompatActivity {
    private static final int SMS_PERMISSION_CODE = 101;
    private EditText etWebhookUrl;
    private TextView tvStatus;
    private Button btnSave, btnTest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Simple programmatic UI layout
        setContentView(R.layout.activity_main);

        etWebhookUrl = findViewById(R.id.et_webhook_url);
        tvStatus = findViewById(R.id.tv_status);
        btnSave = findViewById(R.id.btn_save);
        btnTest = findViewById(R.id.btn_test);

        SharedPreferences prefs = getSharedPreferences("lifeos_settings", Context.MODE_PRIVATE);
        String savedUrl = prefs.getString("webhook_url", "https://lifeos-app-five-eosin.vercel.app/api/finance/webhook");
        etWebhookUrl.setText(savedUrl);

        checkAndRequestPermissions();

        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String url = etWebhookUrl.getText().toString().trim();
                if (url.isEmpty()) {
                    Toast.makeText(MainActivity.this, "Please enter a valid Webhook URL", Toast.LENGTH_SHORT).show();
                    return;
                }
                SharedPreferences.Editor editor = getSharedPreferences("lifeos_settings", Context.MODE_PRIVATE).edit();
                editor.putString("webhook_url", url);
                editor.apply();
                Toast.makeText(MainActivity.this, "Webhook URL Saved Successfully!", Toast.LENGTH_SHORT).show();
                updateStatusText();
            }
        });

        btnTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                testWebhookConnection();
            }
        });

        updateStatusText();
        scanExistingInboxSms();
    }

    private void updateStatusText() {
        boolean hasSmsPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        SharedPreferences prefs = getSharedPreferences("lifeos_settings", Context.MODE_PRIVATE);
        String savedUrl = prefs.getString("webhook_url", "");

        if (!hasSmsPermission) {
            tvStatus.setText("Status: ⚠️ SMS Permission Pending. Please grant SMS permissions.");
        } else if (savedUrl.isEmpty()) {
            tvStatus.setText("Status: ⚠️ SMS Listener Active, but Webhook URL is missing.");
        } else {
            tvStatus.setText("Status: 🟢 Active! Intercepting SMS & Auto-Syncing to LifeOS.");
        }
    }

    private void checkAndRequestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {

            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS, Manifest.permission.POST_NOTIFICATIONS},
                    SMS_PERMISSION_CODE
            );
        }
    }
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "SMS Interceptor Permission Granted!", Toast.LENGTH_SHORT).show();
                scanExistingInboxSms();
            } else {
                Toast.makeText(this, "Permission Denied. Automated SMS sync cannot run.", Toast.LENGTH_LONG).show();
            }
            updateStatusText();
        }
    }

    private void scanExistingInboxSms() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        final String urlStr = etWebhookUrl.getText().toString().trim();
        if (urlStr.isEmpty()) return;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    android.net.Uri smsUri = android.net.Uri.parse("content://sms/inbox");
                    android.database.Cursor cursor = getContentResolver().query(
                            smsUri,
                            new String[]{"_id", "address", "body", "date"},
                            null, null, "date DESC LIMIT 30"
                    );

                    if (cursor != null) {
                        int syncedCount = 0;
                        while (cursor.moveToNext()) {
                            String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                            String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));

                            if (body != null && isFinancialText(body)) {
                                postSmsToWebhook(urlStr, body, address);
                                syncedCount++;
                            }
                        }
                        cursor.close();
                        final int finalCount = syncedCount;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (finalCount > 0) {
                                    Toast.makeText(MainActivity.this, "Auto-synced " + finalCount + " bank SMS from your inbox!", Toast.LENGTH_LONG).show();
                                }
                            }
                        });
                    }
                } catch (Exception e) {
                    android.util.Log.e("LifeOS", "Error scanning SMS inbox", e);
                }
            }
        }).start();
    }

    private boolean isFinancialText(String text) {
        if (text == null || text.trim().isEmpty()) return false;
        String lower = text.toLowerCase();
        boolean hasDigit = lower.matches(".*\\d+.*");
        if (!hasDigit) return false;
        return lower.contains("debited") || lower.contains("credited") || lower.contains("upi") ||
               lower.contains("a/c") || lower.contains("vpa") || lower.contains("inr") ||
               lower.contains("rs") || lower.contains("spent") || lower.contains("paid") ||
               lower.contains("payment") || lower.contains("bank") || lower.contains("amt");
    }

    private void postSmsToWebhook(String webhookUrl, String body, String sender) {
        try {
            URL url = new URL(webhookUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            JSONObject json = new JSONObject();
            json.put("message", body);
            json.put("sender", sender);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.toString().getBytes("UTF-8"));
            }
            conn.getResponseCode();
            conn.disconnect();
        } catch (Exception ignored) {}
    }

    private void testWebhookConnection() {
        final String urlStr = etWebhookUrl.getText().toString().trim();
        if (urlStr.isEmpty()) {
            Toast.makeText(this, "Save a Webhook URL first.", Toast.LENGTH_SHORT).show();
            return;
        }

        Toast.makeText(this, "Sending test transaction payload...", Toast.LENGTH_SHORT).show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    conn.setDoOutput(true);

                    JSONObject testMsg = new JSONObject();
                    testMsg.put("message", "Rs. 250.00 debited from A/C XX9876 to Test Coffee Shop via UPI Ref 998877");
                    testMsg.put("sender", "TEST_BANK");

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(testMsg.toString().getBytes("UTF-8"));
                    }

                    final int code = conn.getResponseCode();
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (code == 200 || code == 201) {
                                Toast.makeText(MainActivity.this, "Test Success! (HTTP " + code + "). Transaction logged in LifeOS.", Toast.LENGTH_LONG).show();
                            } else {
                                Toast.makeText(MainActivity.this, "Server response: HTTP " + code, Toast.LENGTH_LONG).show();
                            }
                        }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Connection Failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }
}
