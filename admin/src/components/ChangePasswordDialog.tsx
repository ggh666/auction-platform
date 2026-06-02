import { useState, type FormEvent } from "react";
import type { AdminLoginResponse } from "@auction/shared";
import { adminPost } from "../api/client";

type ChangePasswordDialogProps = {
  onChanged: () => void;
  onClose: () => void;
};

export function ChangePasswordDialog({ onChanged, onClose }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost<{ admin: AdminLoginResponse["admin"] }>("/admin/auth/change-password", {
        currentPassword,
        newPassword,
        confirmNewPassword
      });
      onChanged();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "修改密码失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        aria-labelledby="change-password-title"
        aria-modal="true"
        className="password-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <h3 id="change-password-title">修改密码</h3>
            <p>修改成功后需要使用新密码重新登录。</p>
          </div>
          <button className="ghost-button" disabled={submitting} onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="password-form-body">
          <label className="publish-field">
            当前密码
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="publish-field">
            新密码
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className="publish-field">
            确认新密码
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              required
              type="password"
              value={confirmNewPassword}
            />
          </label>
          {error ? <p className="notice danger">{error}</p> : null}
          <div className="password-form-actions">
            <button className="ghost-button" disabled={submitting} onClick={onClose} type="button">
              取消
            </button>
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "提交中" : "确认修改"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
