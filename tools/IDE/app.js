// Global variables
let pyodideReadyPromise;
let currentUser = null;
let firestore = null;

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
firestore = firebase.firestore();

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

// Auto-update line numbers
function updateLineNumbers() {
    const textarea = document.getElementById('code-editor');
    const lines = textarea.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
    }
    document.getElementById('line-numbers').textContent = numbers;
}

// Auto-indent and tab handling
document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('code-editor');
    
    textarea.addEventListener('input', updateLineNumbers);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 4;
        }
        if (e.key === 'Enter') {
            const lines = textarea.value.substring(0, textarea.selectionStart).split('\n');
            const currentLine = lines[lines.length - 1];
            const match = currentLine.match(/^(\s*)/);
            const indent = match ? match[0] : '';
            setTimeout(() => {
                const pos = textarea.selectionStart;
                textarea.value = textarea.value.substring(0, pos) + indent + textarea.value.substring(pos);
                textarea.selectionStart = textarea.selectionEnd = pos + indent.length;
                updateLineNumbers();
            }, 1);
        }
    });
    
    updateLineNumbers();
});

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
            hideElement(ide-screen);
            showElement(accessDeniedScreen);
        }
    } catch (error) {
        console.error('Error checking institute access:', error);
        showError('Error checking access permissions. Please try again.');
    }
}

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

runBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const code = document.getElementById('code-editor').value.trim();
    if (!code) {
        showError('Please enter some code to run');
        return;
    }

    // Show running status
    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-indicator';
    statusDiv.className = 'status-indicator';
    statusDiv.textContent = 'Running...';
    statusDiv.style.position = 'absolute';
    statusDiv.style.top = '5px';
    statusDiv.style.right = '10px';
    statusDiv.style.backgroundColor = '#dbeafe';
    statusDiv.style.color = '#2563eb';
    statusDiv.style.padding = '0.25rem 0.5rem';
    statusDiv.style.borderRadius = '6px';
    statusDiv.style.fontSize = '0.8rem';
    statusDiv.style.fontWeight = '500';
    statusDiv.style.zIndex = '1000';

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
        // Remove status indicator
        if (statusDiv.parentNode) {
            statusDiv.parentNode.removeChild(statusDiv);
        }
        runBtn.disabled = false;
    }
});

clearOutputBtn.addEventListener('click', clearOutput);