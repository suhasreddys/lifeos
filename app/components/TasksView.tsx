"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { TaskRecord } from "../api/tasks/route";
import { IconCheckSquare, IconPlus, IconTrash, IconSparkles } from "./Icons";

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
          body: JSON.stringify({ id: task.id, completed: true }),
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
        body: JSON.stringify({ title, category, priority, dueDate, notes }),
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconCheckSquare size={28} style={{ color: "#6366f1" }} />
          <div>
            <strong style={{ fontSize: 28, lineHeight: 1 }}>{pendingCount}</strong>
            <span style={{ display: "block", color: "var(--muted)", fontSize: 13 }}>pending task(s)</span>
          </div>
        </div>
        <div style={{ borderRight: 0, paddingLeft: 16, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>Completion Progress</span>
            <span style={{ fontWeight: 800, color: "var(--brand)", fontSize: 13 }}>{completionPercentage}%</span>
          </div>
          <div className="progress-bar-container" style={{ height: 8, borderRadius: 999, background: "var(--subtle-bg)", overflow: "hidden" }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${completionPercentage}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                borderRadius: 999,
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      </section>

      <div className="calendar-header-toolbar" style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
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
          <IconPlus size={16} />
          <span>Add Task</span>
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
            <span className="empty-state__icon" aria-hidden="true">
              <IconCheckSquare size={36} />
            </span>
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
                    <span className={`priority-badge priority-badge--${t.priority.toLowerCase()}`}>{t.priority}</span>
                    <span className="category-tag">{t.category}</span>
                  </div>

                  {t.notes && <p className="task-notes">{t.notes}</p>}

                  <div className="task-meta">
                    {t.dueDate && <span>Due: {t.dueDate}</span>}
                    {t.source === "document" && (
                      <span className="ai-tag">
                        <IconSparkles size={12} style={{ display: "inline-block", marginRight: 4 }} /> AI Action Item{" "}
                        {t.documentName ? `· ${t.documentName}` : ""}
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
                  className="delete-reminder-button"
                  style={{ position: "relative", top: "auto", right: "auto" }}
                >
                  <IconTrash size={14} />
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
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Add Personal Task</h2>
            <form onSubmit={handleAddTask} className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Task Title</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call Car Insurance Provider"
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "High" | "Medium" | "Low")}
                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Due Date (Optional)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Notes (Optional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details, reference numbers, or context..."
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)" }}
                />
              </label>
              {formError && <p className="upload-message upload-message--error">{formError}</p>}
              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="filter-pill" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Confirmation & Removal Modal */}
      {taskToConfirm && (
        <div className="modal-backdrop" onClick={() => setTaskToConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, textAlign: "center" }}>
            <div style={{ display: "grid", width: 50, height: 50, placeItems: "center", margin: "0 auto 12px", borderRadius: 999, background: "rgba(99, 102, 241, 0.15)", color: "var(--brand)" }}>
              <IconCheckSquare size={24} />
            </div>
            <h2 style={{ marginBottom: "8px", fontSize: 20, fontWeight: 800 }}>
              {taskToConfirm.action === "complete" ? "Mark task complete?" : "Remove Task?"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: "20px", lineHeight: "1.4" }}>
              {taskToConfirm.action === "complete"
                ? `"${taskToConfirm.task.title}" will be marked as complete.`
                : `Are you sure you want to remove "${taskToConfirm.task.title}"?`}
            </p>

            <div className="modal-actions" style={{ justifyContent: "center", gap: "12px", marginTop: "16px" }}>
              <button type="button" className="filter-pill" onClick={() => setTaskToConfirm(null)} style={{ padding: "10px 20px" }}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmAction}
                style={{
                  padding: "10px 20px",
                  background: taskToConfirm.action === "complete" ? "var(--brand)" : "#ef4444",
                  borderColor: taskToConfirm.action === "complete" ? "var(--brand)" : "#ef4444",
                }}
              >
                {taskToConfirm.action === "complete" ? "Yes, Complete Task" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
