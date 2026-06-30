document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileListEl = document.getElementById('file-list');
  const processBtn = document.getElementById('process-btn');
  const jsonOutput = document.getElementById('json-output');
  const statusIndicator = document.getElementById('status-indicator');
  
  let selectedFiles = [];

  // --- Drag and Drop Logic ---
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Prevent browser from opening files if dropped outside the drop zone
  window.addEventListener('dragenter', preventDefaults, false);
  window.addEventListener('dragover', preventDefaults, false);
  window.addEventListener('drop', preventDefaults, false);

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-active');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }, false);

  // --- File Input Logic ---
  
  browseBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    handleFiles(this.files);
    // Reset input so the same file can be selected again if needed
    this.value = null; 
  });

  function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = [...selectedFiles, ...newFiles];
    updateFileListUI();
    validateProcessState();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileListUI();
    validateProcessState();
  }

  function updateFileListUI() {
    fileListEl.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      fileListEl.innerHTML = '<li class="empty-state">No files selected yet.</li>';
      return;
    }

    selectedFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-item-name';
      nameSpan.textContent = file.name;
      nameSpan.title = file.name; // Tooltip for long names
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-file';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => removeFile(index);
      
      li.appendChild(nameSpan);
      li.appendChild(removeBtn);
      fileListEl.appendChild(li);
    });
  }

  function validateProcessState() {
    if (selectedFiles.length > 0) {
      processBtn.removeAttribute('disabled');
    } else {
      processBtn.setAttribute('disabled', 'true');
    }
  }

  // --- API Integration Logic ---

  processBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    // UI Loading State
    processBtn.setAttribute('disabled', 'true');
    processBtn.textContent = 'Processing...';
    statusIndicator.className = 'status-indicator loading';
    statusIndicator.textContent = 'Transforming';
    jsonOutput.innerHTML = '// Connecting to Extractor Pipeline...';

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/candidates/transform', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors ? data.errors.join(', ') : 'Unknown server error');
      }

      // Success State
      statusIndicator.className = 'status-indicator success';
      statusIndicator.textContent = 'Success';
      
      // Syntax Highlight JSON
      const formattedJson = JSON.stringify(data.data, null, 2);
      jsonOutput.innerHTML = syntaxHighlight(formattedJson);

    } catch (error) {
      // Error State
      statusIndicator.className = 'status-indicator error';
      statusIndicator.textContent = 'Failed';
      jsonOutput.innerHTML = `<span style="color: var(--error);">Error: ${error.message}</span>`;
      console.error(error);
    } finally {
      // Reset button
      processBtn.removeAttribute('disabled');
      processBtn.textContent = 'Transform Data';
    }
  });

  // Simple regex-based syntax highlighter for JSON
  function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  }
});
