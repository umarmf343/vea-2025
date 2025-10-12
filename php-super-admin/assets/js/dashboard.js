const modalRoot = document.getElementById('modal-root')
const modalTemplate = document.getElementById('modal-template')

const modalConfigs = {
  newBroadcast: {
    title: 'Compose community broadcast',
    description: 'Share critical updates with staff, parents and students. Messages are delivered through email and in-app notifications.',
    label: 'Message to broadcast',
    placeholder: 'Provide a clear summary, call to action and expected follow-up for the audience...'
  },
  exportReport: {
    title: 'Generate executive report',
    description: 'Choose the insights you want to export. Exports are watermarked automatically for security.',
    label: 'Notes for analytics team',
    placeholder: 'Outline stakeholders, time range and any additional financial notes...'
  },
  approve: target => ({
    title: 'Approve request',
    description: `Share context with the leadership team for "${target}".`,
    label: 'Approval memo',
    placeholder: 'Document the reason for approval, stakeholders involved and next steps...'
  }),
  delegate: target => ({
    title: 'Delegate review',
    description: `Assign a new reviewer for "${target}" and include an expected timeline.`,
    label: 'Delegation note',
    placeholder: 'Provide the name of the delegate, expectations and any blockers to address...'
  }),
  defaulters: {
    title: 'Escalation plan for defaulters',
    description: 'Coordinate with the finance team to follow up on outstanding balances and support parents.',
    label: 'Escalation instructions',
    placeholder: 'Outline call schedule, payment plan options and communication channels...'
  }
}

const toastRoot = document.createElement('div')
toastRoot.className = 'fixed bottom-6 right-6 space-y-3 z-50'
document.body.appendChild(toastRoot)

function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'bg-slate-900/90 text-white px-4 py-3 rounded-xl shadow-xl text-sm flex items-center gap-3 animate-fadeIn'
  toast.innerHTML = `<span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>${message}`
  toastRoot.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2')
    setTimeout(() => toast.remove(), 400)
  }, 3200)
}

function closeModal() {
  modalRoot.innerHTML = ''
  modalRoot.hidden = true
  document.body.classList.remove('overflow-hidden')
}

function openModal(config) {
  const modalContent = modalTemplate.content.cloneNode(true)
  const modal = modalContent.querySelector('.modal-backdrop')
  const titleEl = modalContent.querySelector('[data-modal-title]')
  const descriptionEl = modalContent.querySelector('[data-modal-description]')
  const labelEl = modalContent.querySelector('[data-modal-label]')
  const textarea = modalContent.querySelector('[data-modal-textarea]')
  const closeButtons = modalContent.querySelectorAll('[data-modal-close]')
  const form = modalContent.querySelector('[data-modal-form]')

  titleEl.textContent = config.title
  descriptionEl.textContent = config.description
  labelEl.textContent = config.label
  textarea.placeholder = config.placeholder

  closeButtons.forEach(button => button.addEventListener('click', closeModal))

  form.addEventListener('submit', event => {
    event.preventDefault()
    closeModal()
    showToast('Action submitted successfully. The leadership team has been notified.')
  })

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal()
    }
  })

  modalRoot.hidden = false
  modalRoot.appendChild(modalContent)
  document.body.classList.add('overflow-hidden')
  textarea.focus({ preventScroll: true })
}

function resolveConfig(target, dataset) {
  const config = modalConfigs[target]
  if (typeof config === 'function') {
    return config(dataset.approval || dataset.template || '')
  }
  return config
}

document.querySelectorAll('[data-modal-target]').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const target = trigger.dataset.modalTarget
    const config = resolveConfig(target, trigger.dataset)
    if (!config) {
      return
    }
    openModal(config)
  })
})

document.querySelectorAll('[data-template]').forEach(button => {
  button.addEventListener('click', () => {
    const config = modalConfigs.exportReport
    openModal({
      ...config,
      title: `Launch template · ${button.dataset.template}`,
      description: 'Confirm details for this automated export before sharing with stakeholders.'
    })
  })
})

document.querySelectorAll('[data-message-fill]').forEach(button => {
  button.addEventListener('click', () => {
    const note = button.dataset.messageFill
    const config = modalConfigs.newBroadcast
    openModal({
      ...config,
      title: 'Quick response',
      description: 'Send an immediate follow-up to keep communication flowing.',
      placeholder: note
    })
  })
})

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modalRoot.hidden) {
    closeModal()
  }
})
