"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { TaskRecord } from "../api/tasks/route";

const filters = ["All", "Pending", "Completed", "From Documents", "High Priority"];
const categories = ["Personal", "Work", "Bills", "Health", "Agreements", "Other"];

export default function TasksView() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Personal");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirmation state
  const [taskToConfirm, setTaskToConfirm] = useState<{
    task: TaskRecord;
    action: "complete" | "delete";
  } | null>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then(async (res) => (res.ok ? (res.json() as Promise<TaskRecord[]>) : []))
      .then((data) => setTasks(data))
      .catch(() => {});
  }, []);

  async function handleConfirmAction() {
    if (!taskToConfirm) return;
    const { task, action } = taskToConfirm;
    setTaskToConfirm(null);

    const previousTasks = [...tasks];
    setTasks((current) => current.filter((t) => t.id !== task.id));

    try {
      if (action === "complete") {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, completed: true })
        });
      }
      const res = await fetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove task");
    } catch {
      setTasks(previousTasks);
    }
  }

  async function handleAddTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Task title is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, priority, dueDate, notes })
      });
      const created = (await res.json()) as TaskRecord & { error?: string };
      if (!res.ok) throw new Error(created.error ?? "Failed to add task");

      setTasks((current) => [created, ...current]);
      setTitle("");
      setNotes("");
      setDueDate("");
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const visibleTasks = tasks.filter((t) => {
    if (activeFilter === "Pending") return !t.completed;
    if (activeFilter === "Completed") return t.completed;
    if (activeFilter === "From Documents") return t.source === "document";
    if (activeFilter === "High Priority") return t.priority === "High";
    return true;
  });

  return (
    <>
      <section className="vault-summary" aria-label="Task progress summary">
        <div>
          <strong>{pendingCount}</strong>
          <span>pending task(s)</span>
        </div>
        <div style={{ borderRight: 0, paddingLeft: 16, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>Completion Progress</span>
            <span style={{ fontWeight: 700, color: "var(--brand)" }}>{completionPercentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
      </section>

      <div className="calendar-header-toolbar" style={{ marginTop: 28 }}>
        <div className="filter-pills">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-pill ${activeFilter === f ? "filter-pill--active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={() => setShowModal(true)}>
          + Add Task
        </button>
      </div>

      <section className="document-list section" style={{ paddingTop: 20 }} aria-labelledby="tasks-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TASKS & ACTION ITEMS</p>
            <h2 id="tasks-title">Your Action List</h2>
          </div>
          <span className="result-count">{visibleTasks.length} shown</span>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">✓</span>
            <h2>No tasks in this view</h2>
            <p>Add a new task or switch filters to view completed items.</p>
          </div>
        ) : (
          <div className="task-rows">
            {visibleTasks.map((t) => (
              <div key={t.id} className={`task-row ${t.completed ? "task-row--completed" : ""}`}>
                <label className="task-checkbox-label">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => setTaskToConfirm({ task: t, action: t.completed ? "delete" : "complete" })}
                  />
                  <span className="custom-checkbox" />
                </label>

                <div className="task-content">
                  <div className="task-title-group">
                    <h3 className={t.completed ? "completed-title" : ""}>{t.title}</h3>
                    <span className={`priority-badge priority-badge--${t.priority.toLowerCase()}`}>
                      {t.priority}
                    </span>
                    <span className="category-tag">{t.category}</span>
                  </div>

                  {t.notes && <p className="task-notes">{t.notes}</p>}

                  <div className="task-meta">
                    {t.dueDate && <span>Due: {t.dueDate}</span>}
                    {t.source === "document" && (
                      <span className="ai-tag">
                        🤖 AI Action Item {t.documentName ? `· ${t.documentName}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {t.documentId && (
                  <Link className="document-open" href={`/documents/${t.documentId}`}>
                    Doc →
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setTaskToConfirm({ task: t, action: "delete" })}
                  title="Remove Task"
                  aria-label="Remove Task"
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Task Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Add Personal Task</h2>
            <form onSubmit={handleAddTask} className="modal-form">
              <label>
                <span>Task Title</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call Car Insurance Provider"
                />
              </label>
              <label>
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as "High" | "Medium" | "Low")}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>
              <label>
                <span>Due Date (Optional)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <label>
                <span>Notes (Optional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details, reference numbers, or context..."
                />
              </label>
              {formError && <p className="upload-message upload-message--error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="filter-pill" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Save Task"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Confirmation & Removal Modal */}
      {taskToConfirm && (
        <div className="modal-backdrop" onClick={() => setTaskToConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>
              {taskToConfirm.action === "complete" ? "✅" : "⚠️"}
            </div>
            <h2 style={{ marginBottom: "8px" }}>
              {taskToConfirm.action === "complete" ? "Is this task complete?" : "Remove Task?"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: "20px", lineHeight: "1.4" }}>
              {taskToConfirm.action === "complete"
                ? `"${taskToConfirm.task.title}" will be marked as complete and removed from your Action List.`
                : `Are you sure you want to remove "${taskToConfirm.task.title}"?`}
            </p>

            <div className="modal-actions" style={{ justifyContent: "center", gap: "12px", marginTop: "16px" }}>
              <button
                type="button"
                className="filter-pill"
                onClick={() => setTaskToConfirm(null)}
                style={{ padding: "10px 20px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmAction}
                style={{
                  padding: "10px 20px",
                  background: taskToConfirm.action === "complete" ? "var(--brand)" : "#ef4444",
                  borderColor: taskToConfirm.action === "complete" ? "var(--brand)" : "#ef4444"
                }}
              >
                {taskToConfirm.action === "complete" ? "Yes, Complete & Remove" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
