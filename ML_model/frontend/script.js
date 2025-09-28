// Change this line in script.js - use your actual IP


// DOM elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const predictBtn = document.getElementById('predictBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsPlaceholder = document.getElementById('resultsPlaceholder');
const modelStatus = document.getElementById('modelStatus');
const modelType = document.getElementById('modelType');
const modelAccuracy = document.getElementById('modelAccuracy');
const modelLastTrained = document.getElementById('modelLastTrained');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const getModelInfoBtn = document.getElementById('getModelInfoBtn');
const apiTestResult = document.getElementById('apiTestResult');
const backendStatus = document.getElementById('backendStatus');

let currentFile = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();
    loadModelInfo();
    
    testConnectionBtn.addEventListener('click', testBackendConnection);
    getModelInfoBtn.addEventListener('click', getModelInfo);
});

// Drag and drop functionality
function initializeDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);
    predictBtn.addEventListener('click', handlePrediction);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropZone.style.borderColor = '#667eea';
    dropZone.style.backgroundColor = '#f0f4ff';
}

function unhighlight() {
    dropZone.style.borderColor = '#ccc';
    dropZone.style.backgroundColor = '';
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect() {
    handleFiles(this.files);
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            fileInfo.innerHTML = `<p>Selected file: <strong>${file.name}</strong> (${formatFileSize(file.size)})</p>`;
            predictBtn.disabled = false;
            currentFile = file;
        } else {
            fileInfo.innerHTML = '<p style="color: red;">Please select a CSV file</p>';
            predictBtn.disabled = true;
            currentFile = null;
        }
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// API Functions
async function loadModelInfo() {
    try {
        modelStatus.textContent = 'Loading...';
        const response = await fetch(`${API_BASE_URL}/model-info`);
        const data = await response.json();
        
        if (data.success) {
            modelStatus.textContent = data.status;
            modelType.textContent = data.model_type;
            modelAccuracy.textContent = data.accuracy ? `${(data.accuracy * 100).toFixed(2)}%` : 'Not calculated';
            modelLastTrained.textContent = data.last_trained ? new Date(data.last_trained).toLocaleString() : 'Unknown';
            backendStatus.textContent = 'Connected';
            backendStatus.style.color = 'lightgreen';
        }
    } catch (error) {
        console.error('Error loading model info:', error);
        modelStatus.textContent = 'Backend not connected';
        backendStatus.textContent = 'Not Connected';
        backendStatus.style.color = 'red';
    }
}

async function handlePrediction() {
    if (!currentFile) return;
    
    resultsPlaceholder.style.display = 'none';
    resultsContainer.innerHTML = '<div class="status loading">Processing your dataset... Please wait.</div>';
    resultsContainer.style.display = 'block';
    predictBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResults(data);
        } else {
            resultsContainer.innerHTML = `<div class="status error">Error: ${data.error || 'Prediction failed'}</div>`;
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="status error">Connection error. Please check if the backend is running.</div>';
    } finally {
        predictBtn.disabled = false;
    }
}

function displayResults(data) {
    let html = '<div class="status success">Prediction completed successfully!</div>';
    
    html += `<h3>Summary</h3>`;
    html += `<p>Total samples processed: ${data.summary.total_samples}</p>`;
    html += `<p>Model used: ${data.summary.model_used}</p>`;
    
    if (data.summary.accuracy) {
        html += `<p>Accuracy: ${(data.summary.accuracy * 100).toFixed(2)}%</p>`;
    }
    
    if (data.predictions && data.predictions.length > 0) {
        html += `<h3>Sample Predictions (first 10 rows)</h3>`;
        html += `<div style="overflow-x: auto;"><table>`;
        html += `<tr><th>ID</th><th>Prediction</th><th>Confidence</th></tr>`;
        
        data.predictions.slice(0, 10).forEach(pred => {
            html += `<tr>
                <td>${pred.id}</td>
                <td>${pred.prediction}</td>
                <td>${pred.confidence ? (pred.confidence * 100).toFixed(2) + '%' : 'N/A'}</td>
            </tr>`;
        });
        
        html += `</table></div>`;
        
        if (data.predictions.length > 10) {
            html += `<p>... and ${data.predictions.length - 10} more predictions</p>`;
        }
    }
    
    resultsContainer.innerHTML = html;
}

async function testBackendConnection() {
    apiTestResult.innerHTML = '<div class="status loading">Testing connection...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            apiTestResult.innerHTML = '<div class="status success">✅ Backend is connected and healthy!</div>';
        } else {
            apiTestResult.innerHTML = '<div class="status error">❌ Backend responded but with unexpected status</div>';
        }
    } catch (error) {
        apiTestResult.innerHTML = '<div class="status error">❌ Cannot connect to backend. Make sure it\'s running on port 5000.</div>';
    }
}

async function getModelInfo() {
    apiTestResult.innerHTML = '<div class="status loading">Fetching model info...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/model-info`);
        const data = await response.json();
        
        if (data.success) {
            apiTestResult.innerHTML = `
                <div class="status success">✅ Model info retrieved successfully!</div>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            `;
        } else {
            apiTestResult.innerHTML = `<div class="status error">❌ Error: ${data.error}</div>`;
        }
    } catch (error) {
        apiTestResult.innerHTML = '<div class="status error">❌ Cannot connect to backend.</div>';
    }
}

// Try both URLs - the frontend will use whichever works
const API_URLS = [
    'http://10.1.16.47:5000/api',
    'http://127.0.0.1:5000/api',
    'http://localhost:5000/api'
];

// Function to find working API URL
async function findWorkingAPI() {
    for (const url of API_URLS) {
        try {
            const response = await fetch(`${url}/health`);
            if (response.ok) {
                return url;
            }
        } catch (error) {
            console.log(`Failed to connect to ${url}`);
        }
    }
    throw new Error('No working API URL found');
}

// Use the working API URL
let API_BASE_URL = 'http://10.1.16.47:5000/api'; // Default

// Test connection on page load
findWorkingAPI().then(workingUrl => {
    API_BASE_URL = workingUrl;
    console.log('Using API URL:', API_BASE_URL);
    backendStatus.textContent = 'Connected';
    backendStatus.style.color = 'lightgreen';
}).catch(error => {
    console.error('No API connection:', error);
    backendStatus.textContent = 'Not Connected';
    backendStatus.style.color = 'red';
});