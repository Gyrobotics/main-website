// Global variables
let pyodideReadyPromise;
let currentUser = null;
let firestore = null;

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
firestore = firebase.firestore();

// === CURSOR POSITION UTILITIES ===
function saveCursor(container) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(container);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const startLen = preCaretRange.toString().length;
    return startLen;
}

function restoreCursor(container, charIndex) {
    if (charIndex === null || charIndex < 0) return;

    const doc = container.ownerDocument || container.document;
    const range = doc.createRange();
    range.selectNodeContents(container);

    let pos = 0;
    const walker = doc.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while ((node = walker.nextNode()) && pos < charIndex) {
        const nextPos = pos + node.textContent.length;
        if (nextPos >= charIndex) {
            range.setStart(node, charIndex - pos);
            range.collapse(true);
            break;
        }
        pos = nextPos;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

// Initialize Pyodide
async function initPyodide() {
    const pyodide = await loadPyodide();
    pyodide.globals.set("__kidlang_input", (prompt_msg) => {
        const result = prompt(prompt_msg);
        return result === null ? "" : result;
    });
    const translatorCode = await fetch('translator.py').then(response => response.text());
    pyodide.runPython(translatorCode);
    return pyodide;
}

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const accessDeniedScreen = document.getElementById('access-denied');
const ideScreen = document.getElementById('ide-screen');
const outputConsole = document.getElementById('output-console');
const errorDisplay = document.getElementById('error-display');
const runBtn = document.getElementById('run-btn');
const clearOutputBtn = document.getElementById('clear-output');
const logoutBtn = document.getElementById('logout-btn');
const ideLogoutBtn = document.getElementById('ide-logout-btn');
const userDisplay = document.getElementById('user-display');

const googleLoginBtn = document.getElementById('google-login');
const emailLoginBtn = document.getElementById('email-login');
const emailForm = document.getElementById('email-form');
const backBtn = document.getElementById('back-btn');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

// Editor elements
const codeEditorPre = document.getElementById('code-editor'); // the <pre>
const codeBlock = codeEditorPre.querySelector('code');         // the <code>
const lineNumbers = document.getElementById('line-numbers');

// Auto-update line numbers
function updateLineNumbers() {
    const lines = codeBlock.textContent.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
    }
    lineNumbers.textContent = numbers;
}

// Sync scroll between editor and line numbers
codeEditorPre.addEventListener('scroll', () => {
    lineNumbers.scrollTop = codeEditorPre.scrollTop;
});

// Handle input with cursor preservation
let isHandlingInput = false;

codeBlock.addEventListener('input', () => {
    if (isHandlingInput) return;
    isHandlingInput = true;

    const savedPos = saveCursor(codeBlock);
    Prism.highlightElement(codeBlock);
    updateLineNumbers();

    setTimeout(() => {
        restoreCursor(codeBlock, savedPos);
        isHandlingInput = false;
    }, 0);
});

// Tab key handling
codeBlock.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const savedPos = saveCursor(codeBlock);

        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const tabNode = document.createTextNode('    ');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);

        selection.removeAllRanges();
        selection.addRange(range);

        // Re-highlight with cursor restore
        Prism.highlightElement(codeBlock);
        updateLineNumbers();
        setTimeout(() => restoreCursor(codeBlock, savedPos + 4), 0);
    }
});

// Initial setup
Prism.highlightElement(codeBlock);
updateLineNumbers();

// Utility functions
function showElement(element) {
    element.classList.remove('hidden');
}

function hideElement(element) {
    element.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    showElement(errorMessage);
    setTimeout(() => hideElement(errorMessage), 5000);
}

function showOutput(text) {
    outputConsole.textContent += text;
    outputConsole.scrollTop = outputConsole.scrollHeight;
}

function clearOutput() {
    outputConsole.textContent = '';
    hideElement(errorDisplay);
}

// Auth state change
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        userDisplay.textContent = user.email;
        try {
            const userDoc = await firestore.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                await firestore.collection('users').doc(user.uid).set({
                    email: user.email,
                    institute: 'default'
                });
                checkInstituteAccess('default');
            } else {
                const userData = userDoc.data();
                checkInstituteAccess(userData.institute || 'default');
            }
        } catch (error) {
            console.error('Error checking user ', error);
            showError('Error loading user data. Please try again.');
        }
    } else {
        hideElement(ideScreen);
        hideElement(accessDeniedScreen);
        showElement(loginScreen);
        currentUser = null;
    }
});

async function checkInstituteAccess(instituteName) {
    try {
        const instituteDoc = await firestore.collection('institutes').doc(instituteName).get();
        if (instituteDoc.exists && instituteDoc.data().allowed === true) {
            if (!pyodideReadyPromise) {
                pyodideReadyPromise = initPyodide();
            }
            hideElement(loginScreen);
            hideElement(accessDeniedScreen);
            showElement(ideScreen);
        } else {
            hideElement(loginScreen);
            hideElement(ideScreen);
            showElement(accessDeniedScreen);
        }
    } catch (error) {
        console.error('Error checking institute access:', error);
        showError('Error checking access permissions. Please try again.');
    }
}

// Auth UI handlers
googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(showError);
});

emailLoginBtn.addEventListener('click', () => {
    showElement(emailForm);
    hideElement(googleLoginBtn);
    hideElement(emailLoginBtn);
});

backBtn.addEventListener('click', () => {
    hideElement(emailForm);
    showElement(googleLoginBtn);
    showElement(emailLoginBtn);
    emailInput.value = '';
    passwordInput.value = '';
    hideElement(errorMessage);
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    auth.signInWithEmailAndPassword(email, password).catch(showError);
});

signupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            return firestore.collection('users').doc(auth.currentUser.uid).set({
                email: email,
                institute: 'default'
            });
        })
        .catch(showError);
});

logoutBtn.addEventListener('click', () => auth.signOut());
ideLogoutBtn.addEventListener('click', () => auth.signOut());

// Run button
runBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const code = codeBlock.textContent.trim();
    if (!code) {
        showError('Please enter some code to run');
        return;
    }

    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-indicator';
    statusDiv.className = 'status-indicator';
    statusDiv.textContent = 'Running...';
    Object.assign(statusDiv.style, {
        position: 'absolute',
        top: '5px',
        right: '10px',
        backgroundColor: '#dbeafe',
        color: '#2563eb',
        padding: '0.25rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '500',
        zIndex: '1000'
    });

    const toolbar = document.querySelector('.editor-toolbar');
    toolbar.appendChild(statusDiv);

    runBtn.disabled = true;
    clearOutput();

    try {
        const pyodide = await pyodideReadyPromise;
        const rawResult = pyodide.runPython(`
import sys
from io import StringIO

old_stdout = sys.stdout
old_stderr = sys.stderr
captured_output = StringIO()
captured_error = StringIO()
sys.stdout = captured_output
sys.stderr = captured_error

try:
    global_ns = globals()
    translated_code = translate_kidlang_code('''${code}''')
    exec(translated_code, global_ns)
    output = captured_output.getvalue()
    error = captured_error.getvalue()
    final_output = output + error
except Exception as e:
    import traceback
    output = captured_output.getvalue()
    error = captured_error.getvalue()
    tb_str = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    final_output = output + error + "\\n" + tb_str
finally:
    sys.stdout = old_stdout
    sys.stderr = old_stderr

final_output
`);

        const fullOutput = String(rawResult || '');
        if (fullOutput.trim()) {
            showOutput(fullOutput);
        }

        const usageRef = firestore.collection('usage').doc(currentUser.uid);
        const usageDoc = await usageRef.get();
        if (usageDoc.exists) {
            await usageRef.update({
                totalRuns: firebase.firestore.FieldValue.increment(1),
                lastRun: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await usageRef.set({
                totalRuns: 1,
                lastRun: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

    } catch (err) {
        console.error('Execution error:', err);
        errorDisplay.textContent = `Runtime Error: ${err.message || JSON.stringify(err)}`;
        showElement(errorDisplay);
    } finally {
        if (statusDiv.parentNode) {
            statusDiv.parentNode.removeChild(statusDiv);
        }
        runBtn.disabled = false;
    }
});

clearOutputBtn.addEventListener('click', clearOutput);