export const toggleAppFullscreen = () => {
  if (window.pywebview?.api?.toggle_fullscreen) {
    window.pywebview.api.toggle_fullscreen();
    return;
  }
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
};

export const selectDatabaseFileDialog = async (mode = 'open', defaultName = 'archiv.db') => {
  // 1. Try PyWebView native dialog
  if (window.pywebview?.api) {
    try {
      if (mode === 'create' || mode === 'save') {
        if (window.pywebview.api.choose_new_database_file) {
          const path = await window.pywebview.api.choose_new_database_file(defaultName);
          return path || null;
        }
      } else {
        if (window.pywebview.api.choose_database_file) {
          const path = await window.pywebview.api.choose_database_file();
          return path || null;
        }
      }
    } catch (err) {
      console.warn('PyWebView file dialog failed, trying backend fallback:', err);
    }
  }

  // 2. Fallback to backend dialog endpoint (browser mode only)
  try {
    const res = await fetch(`/api/system/dialog/select-db?mode=${encodeURIComponent(mode)}&default_name=${encodeURIComponent(defaultName)}`);
    if (res.ok) {
      const data = await res.json();
      return data.path || null;
    }
  } catch (err) {
    console.error('Backend file dialog failed:', err);
  }

  return null;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result || '';
    const base64 = typeof dataUrl === 'string' ? (dataUrl.split(',')[1] || '') : '';
    resolve(base64);
  };
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export const openAssetExternally = (fileUrl) => {
  if (!fileUrl) return;
  if (window.pywebview?.api?.open_url_externally) {
    window.pywebview.api.open_url_externally(fileUrl);
    return;
  }
  window.open(fileUrl, '_blank', 'noopener,noreferrer');
};

export const saveBlobWithDialog = async (blob, defaultFilename, fileTypeLabel = 'Datei', extension = '*') => {
  // 1. Native PyWebView Save As dialog in desktop mode
  if (window.pywebview?.api?.save_file_dialog && window.pywebview?.api?.write_base64_file) {
    const targetPath = await window.pywebview.api.save_file_dialog(defaultFilename, fileTypeLabel, extension);
    if (!targetPath) {
      return { saved: false, cancelled: true };
    }
    const b64 = await blobToBase64(blob);
    await window.pywebview.api.write_base64_file(targetPath, b64);
    return { saved: true, cancelled: false, path: targetPath };
  }

  // 2. Browser fallback download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 500);
  return { saved: true, cancelled: false };
};

