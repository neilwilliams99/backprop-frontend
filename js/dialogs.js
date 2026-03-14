// ════════════════════════════════════════════════
//  CUSTOM DIALOG (replaces browser prompt/confirm)
// ════════════════════════════════════════════════
let _dialogResolve = null;

function _openDialog({ title, sub='', confirmText='Confirm', confirmClass='btn-accent', dangerConfirm=false,
                       input=null, inputPlaceholder='', inputDefault='',
                       input2Label='', input2Placeholder='', input2Default='',
                       cancelText='Cancel' }) {
  // Handle cancel button visibility
  const cancelBtn = document.getElementById('dialogCancel');
  if (cancelBtn) {
    cancelBtn.style.display = cancelText === null ? 'none' : 'inline-block';
    if (cancelText && cancelText !== 'Cancel') cancelBtn.textContent = cancelText;
    else cancelBtn.textContent = 'Cancel';
  }
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogSub').textContent = sub;
  document.getElementById('dialogSub').style.display = sub ? 'block' : 'none';

  const inputWrap = document.getElementById('dialogInputWrap');
  const inp = document.getElementById('dialogInput');
  if (input) {
    inputWrap.style.display = 'block';
    inp.placeholder = inputPlaceholder;
    inp.value = inputDefault;
    const input2Wrap = document.getElementById('dialogInput2Wrap');
    if (input2Label) {
      input2Wrap.style.display = 'block';
      document.getElementById('dialogInput2Label').textContent = input2Label;
      document.getElementById('dialogInput2').placeholder = input2Placeholder;
      document.getElementById('dialogInput2').value = input2Default;
    } else {
      input2Wrap.style.display = 'none';
    }
  } else {
    inputWrap.style.display = 'none';
    document.getElementById('dialogInput2Wrap').style.display = 'none';
  }

  const confirmBtn = document.getElementById('dialogConfirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = 'btn ' + (dangerConfirm ? 'btn-danger' : confirmClass);

  document.getElementById('customDialog').classList.add('open');
  if (input) setTimeout(() => inp.focus(), 50);

  return new Promise(resolve => {
    _dialogResolve = resolve;
  });
}

function _closeDialog(result) {
  document.getElementById('customDialog').classList.remove('open');
  if (_dialogResolve) { _dialogResolve(result); _dialogResolve = null; }
}

// Dialog listeners attached via onclick attributes in HTML

async function dlgConfirm(title, sub='', confirmText='Delete', danger=true) {
  return _openDialog({ title, sub, confirmText, dangerConfirm: danger });
}

async function dlgPrompt(title, sub='', inputPlaceholder='', inputDefault='', input2Label='', input2Placeholder='', input2Default='', confirmText='Create') {
  return _openDialog({ title, sub, input: true, inputPlaceholder, inputDefault, input2Label, input2Placeholder, input2Default, confirmText });
}

async function dlgAlert(title, sub='', confirmText='OK') {
  return _openDialog({ title, sub, confirmText, cancelText: null, dangerConfirm: false });
}
