/**
 * Barramento de eventos leve usado para atualizar telas diferentes sem
 * exigir recarga da página (ex.: nova viagem cadastrada na tela de Viagens
 * atualiza o resumo do Dashboard automaticamente).
 */
const emitter = new EventTarget()

export const tripEvents = {
  on(listener: () => void) {
    emitter.addEventListener('trip:created', listener)
    return () => emitter.removeEventListener('trip:created', listener)
  },
  emit() {
    emitter.dispatchEvent(new Event('trip:created'))
  },
}
