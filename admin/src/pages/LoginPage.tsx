import { useState } from "react";
import type { AdminLoginResponse } from "@auction/shared";
import { adminLogin } from "../api/client";
import { saveAdminSession } from "../auth/session";

type LoginPageProps = {
  notice?: string;
  onLoggedIn: (admin: AdminLoginResponse["admin"]) => void;
};

const isDevelopment = import.meta.env.DEV;

export function LoginPage({ notice, onLoggedIn }: LoginPageProps) {
  const [username, setUsername] = useState(isDevelopment ? "reviewer" : "");
  const [password, setPassword] = useState(isDevelopment ? "reviewer-pass" : "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await adminLogin(username, password);
      saveAdminSession(result.token, result.admin);
      onLoggedIn(result.admin);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "用户名或密码错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">Auction Admin</p>
          <h1>管理后台登录</h1>
          <p className="form-hint">
            {isDevelopment ? "本地开发账号：reviewer / reviewer-pass" : "请输入管理员账号登录"}
          </p>
        </div>
        {notice ? <p className="notice success">{notice}</p> : null}
        <label>
          用户名
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入管理员用户名"
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入管理员密码"
            type="password"
          />
        </label>
        <button disabled={submitting} type="submit">
          {submitting ? "登录中" : "登录"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
  );
}
