import { type FormEvent, useState } from "react"
import { useReaderRuntime } from "../reader-runtime.js"

/** Render the single-reader password form. / single-reader password form を描画します。 */
export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { client, presentation } = useReaderRuntime()
  const { messages } = presentation
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(undefined)
    try {
      await client.login(password)
      setPassword("")
      onAuthenticated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login できませんでした。")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <span className="eyebrow">{messages.loginEyebrow}</span>
        <h1>{messages.loginTitle}</h1>
        <p>{messages.loginPrompt}</p>
        <label htmlFor="password">{messages.passwordLabel}</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? messages.loginPending : messages.loginButton}
        </button>
      </form>
    </main>
  )
}
