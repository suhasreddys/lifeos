package com.lifeos.sms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeOSSmsReceiver";
    private static final String CHANNEL_ID = "lifeos_sms_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            String format = bundle.getString("format");

            if (pdus == null) return;

            StringBuilder fullMessage = new StringBuilder();
            String sender = "";

            for (Object pdu : pdus) {
                SmsMessage smsMessage;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                }

                if (smsMessage != null) {
                    if (sender.isEmpty()) {
                        sender = smsMessage.getDisplayOriginatingAddress();
                    }
                    fullMessage.append(smsMessage.getMessageBody());
                }
            }

            String smsText = fullMessage.toString().trim();
            if (isFinancialSms(smsText, sender)) {
                Log.d(TAG, "Financial SMS detected from " + sender + ": " + smsText);
                sendSmsToLifeOS(context, smsText, sender);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming SMS", e);
        }
    }

    private boolean isFinancialSms(String text, String sender) {
        if (text == null || text.trim().isEmpty()) return false;
        String lower = text.toLowerCase();

        boolean hasDigit = lower.matches(".*\\d+.*");
        if (!hasDigit) return false;

        boolean hasKeyword = lower.contains("debited") || lower.contains("credited") ||
                lower.contains("upi") || lower.contains("a/c") || lower.contains("acct") ||
                lower.contains("vpa") || lower.contains("inr") || lower.contains("rs") ||
                lower.contains("spent") || lower.contains("transferred") || lower.contains("sent") ||
                lower.contains("paid") || lower.contains("payment") || lower.contains("bank") ||
                lower.contains("amt") || lower.contains("card") || lower.contains("bill");

        return hasKeyword;
    }

    private void sendSmsToLifeOS(final Context context, final String smsText, final String sender) {
        SharedPreferences prefs = context.getSharedPreferences("lifeos_settings", Context.MODE_PRIVATE);
        String webhookUrl = prefs.getString("webhook_url", "");

        if (webhookUrl.isEmpty()) {
            webhookUrl = "https://lifeos-app-five-eosin.vercel.app/api/finance/webhook";
        }
        final String finalWebhookUrl = webhookUrl;

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(finalWebhookUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);

                    JSONObject jsonParam = new JSONObject();
                    jsonParam.put("message", smsText);
                    jsonParam.put("sender", sender);
                    jsonParam.put("timestamp", System.currentTimeMillis());

                    byte[] postData = jsonParam.toString().getBytes("UTF-8");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(postData, 0, postData.length);
                    }

                    int responseCode = conn.getResponseCode();
                    Log.d(TAG, "Webhook response code: " + responseCode);

                    if (responseCode == 200 || responseCode == 201) {
                        showSyncNotification(context, "LifeOS Auto-Sync", "Intercepted & logged bank SMS transaction!");
                    } else {
                        Log.e(TAG, "Webhook error response: " + responseCode);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to POST SMS to LifeOS Webhook", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    private void showSyncNotification(Context context, String title, String body) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "LifeOS SMS Auto-Sync Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            notificationManager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
