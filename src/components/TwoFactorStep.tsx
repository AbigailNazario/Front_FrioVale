import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Copy, KeyRound, ShieldCheck } from 'lucide-react'
import { api, type AuthResponse, type LoginChallenge, type TotpSetup } from '../api'

/**
 * [Seguranca - 2FA] Segunda etapa do login.
 *
 * - enrollmentRequired = true: mostra o QR Code, pede o primeiro codigo e exibe os codigos de recuperacao.
 * - enrollmentRequired = false: pede o codigo do aplicativo ou um codigo de recuperacao.
 *
 * Esta tela apenas coleta o codigo: quem decide se ele e valido e o backend.
 * O token de acesso so e salvo depois que o backend aceita o segundo fator.
 */
type Mode = 'enroll' | 'otp' | 'recovery' | 'codes'

interface Props {
  challenge: LoginChallenge
  onDone: (auth: AuthResponse) => void
  onCancel: () => void
}

export default function TwoFactorStep({ challenge, onDone, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>(challenge.enrollmentRequired ? 'enroll' : 'otp')
  const [setup, setSetup] = useState<TotpSetup>()
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [pendingAuth, setPendingAuth] = useState<AuthResponse>()
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  // Cadastro: o backend gera o segredo e devolve o QR Code
  useEffect(() => {
    if (!challenge.enrollmentRequired) return
    api.twoFactorSetup(challenge.mfaToken)
      .then(setSetup)
      .catch(err => setError(err instanceof Error ? err.message : 'Não foi possível gerar o QR Code.'))
  }, [challenge])

  const fail = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'Não foi possível validar o código.')
    setCode('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'enroll') {
        const result = await api.twoFactorConfirm(challenge.mfaToken, code)
        setCodes(result.recoveryCodes)
        setPendingAuth(result.auth)
        setMode('codes')
      } else if (mode === 'otp') {
        onDone(await api.twoFactorVerify(challenge.mfaToken, code))
      } else if (mode === 'recovery') {
        onDone(await api.twoFactorRecovery(challenge.mfaToken, recoveryCode))
      } else if (pendingAuth) {
        onDone(pendingAuth)
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setInfo('Códigos copiados.')
    } catch {
      setInfo('Não foi possível copiar automaticamente. Anote os códigos.')
    }
  }

  const codeInput = (
    <>
      <label>Código de 6 dígitos</label>
      <input
        className="otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={6}
        pattern="\d{6}"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        required
        autoFocus
      />
    </>
  )

  return (
    <form onSubmit={submit}>
      <span className="eyebrow">Verificação em duas etapas</span>

      {mode === 'enroll' && (
        <>
          <h2>Proteja sua conta</h2>
          <p className="muted">
            Escaneie o QR Code com o Google Authenticator, Microsoft Authenticator ou Authy
            e digite o código gerado pelo aplicativo.
          </p>
          <div className="qr-box">
            {setup
              ? <img src={setup.qrCodeDataUri} alt="QR Code para cadastrar o aplicativo autenticador" width={200} height={200} />
              : <small>{error ? 'QR Code indisponível' : 'Gerando QR Code...'}</small>}
          </div>
          {codeInput}
        </>
      )}

      {mode === 'otp' && (
        <>
          <h2>Digite o código</h2>
          <p className="muted">Abra o aplicativo autenticador e informe o código atual da conta FrioVale.</p>
          {codeInput}
        </>
      )}

      {mode === 'recovery' && (
        <>
          <h2>Código de recuperação</h2>
          <p className="muted">Use um dos códigos que você guardou ao ativar a verificação. Cada código funciona uma única vez.</p>
          <label>Código de recuperação</label>
          <input
            placeholder="XXXXX-XXXXX"
            maxLength={16}
            value={recoveryCode}
            onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
            required
            autoFocus
          />
        </>
      )}

      {mode === 'codes' && (
        <>
          <h2>Guarde seus códigos</h2>
          <p className="muted">
            Se perder o celular, use um destes códigos para entrar. Cada um vale uma única vez
            e eles não serão exibidos novamente.
          </p>
          <ul className="codes-grid">{codes.map(c => <li key={c}><code>{c}</code></li>)}</ul>
          <button type="button" className="btn ghost" onClick={copyCodes}><Copy size={13} /> Copiar códigos</button>
        </>
      )}

      {error && <p className="muted" role="alert" style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {info && <p className="muted msg-ok" style={{ marginTop: 12 }}>{info}</p>}

      <button className="btn primary block" type="submit" disabled={busy || (mode === 'enroll' && !setup)}>
        {busy ? 'Validando...'
          : mode === 'codes' ? <>Já guardei meus códigos <ShieldCheck size={16} /></>
            : <>Confirmar <ArrowRight size={16} /></>}
      </button>

      {(mode === 'otp' || mode === 'recovery') && (
        <div className="tabs">
          <button type="button" className={mode === 'otp' ? 'on' : ''} onClick={() => { setMode('otp'); setError('') }}>
            Aplicativo autenticador
          </button>
          <button type="button" className={mode === 'recovery' ? 'on' : ''} onClick={() => { setMode('recovery'); setError('') }}>
            <KeyRound size={13} /> Código de recuperação
          </button>
        </div>
      )}

      {mode !== 'codes' && (
        <p className="legal">
          <button type="button" className="link-btn" onClick={onCancel}>Voltar para o login</button>
        </p>
      )}
    </form>
  )
}
