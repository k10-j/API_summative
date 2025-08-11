// Global variables
const summarizeButton = document.getElementById('summarizeButton');
const translateButton = document.getElementById('translateButton');
const inputText = document.getElementById('inputText');
const summaryOutput = document.getElementById('summaryOutput');
const originalOutput = document.getElementById('originalOutput');
const translationOutput = document.getElementById('translationOutput');
const langSelect = document.getElementById('langSelect');
const keyFindings = document.getElementById('keyFindings');
const keywords = document.getElementById('keywords');
const exportPdfBtn = document.getElementById('exportPdf');
const exportWordBtn = document.getElementById('exportWord');

let currentChart = null;

// Configuration - my api keys 
const CONFIG = {
    HUGGINGFACE_API_KEY: 'hf_1JJVoJkblJmkKmJVVYMnRrCWUXWPJnuJWW', 
    TRANSLATION_API_KEY: ' 138b3b927dmsh3e22f698f7988cbp10ea2ejsn629d064b2412', 
};

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    summarizeButton.addEventListener('click', handleSummarize);
    translateButton.addEventListener('click', handleTranslate);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    exportPdfBtn.addEventListener('click', handleExportPdf);
    exportWordBtn.addEventListener('click', handleExportWord);
}

// Main summarization handler
async function handleSummarize() {
    const text = inputText.value.trim();
    if (!text) {
        showAlert('Please enter some text to summarize.');
        return;
    }

    if (text.length < 50) {
        showAlert('Please enter a longer text (at least 50 characters) for meaningful summarization.');
        return;
    }

    setButtonLoading(summarizeButton, true);
    showLoadingMessage(summaryOutput, 'Summarizing text...');
    originalOutput.textContent = text;

    try {
        const summary = await summarizeText(text);
        displaySummary(summary);
        updateInsights(text, summary);
        updateChart(text, summary);
        showSuccessMessage('Summary generated successfully!');
    } catch (err) {
        console.error('Summarization error:', err);
        handleSummarizationError(text);
    } finally {
        setButtonLoading(summarizeButton, false);
    }
}

// Main translation handler
async function handleTranslate() {
    const text = summaryOutput.textContent.trim();
    const lang = langSelect.value;
    
    if (!text || text.includes('Failed to summarize') || text.includes('Summary will appear')) {
        showAlert('Please generate a summary first.');
        return;
    }
    
    if (!lang) {
        showAlert('Please select a target language.');
        return;
    }

    setButtonLoading(translateButton, true);
    showLoadingMessage(translationOutput, 'Translating...');

    try {
        const translated = await translateText(text, lang);
        translationOutput.textContent = translated;
        showSuccessMessage('Translation completed!');
    } catch (err) {
        console.error('Translation error:', err);
        showErrorMessage(translationOutput, 'Translation service unavailable. Please try again later.');
    } finally {
        setButtonLoading(translateButton, false);
    }
}

// Summarization function with fallback
async function summarizeText(text) {
    // my API-based summarization first
    if (CONFIG.HUGGINGFACE_API_KEY) {
        try {
            return await apiSummarizeText(text);
        } catch (error) {
            console.error("API summarization failed:", error);
        }
    }
    
    // Fallback to extractive summarization
    console.log("Using fallback extractive summarization");
    return createExtractiveSummary(text);
}

// API-based summarization
async function apiSummarizeText(text) {
    const response = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.HUGGINGFACE_API_KEY}`
        },
        body: JSON.stringify({ 
            inputs: text,
            parameters: {
                max_length: 150,
                min_length: 50,
                do_sample: false
            }
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
        throw new Error(result.error);
    }

    // Handle different response formats
    if (Array.isArray(result) && result[0]?.summary_text) {
        return result[0].summary_text;
    } else if (result.summary_text) {
        return result.summary_text;
    } else {
        throw new Error("Unexpected API response format");
    }
}

// Fallback extractive summarization
function createExtractiveSummary(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length <= 3) {
        return text; // Text is already short
    }

    // Simple extractive summarization algorithm
    const sentenceScores = calculateSentenceScores(sentences, text);
    const topSentences = getTopSentences(sentences, sentenceScores, 3);
    
    return topSentences.join('. ').trim() + '.';
}

// Calculate sentence importance scores
function calculateSentenceScores(sentences, fullText) {
    const wordFreq = calculateWordFrequency(fullText);
    const scores = [];

    sentences.forEach((sentence, index) => {
        const words = sentence.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
        let score = 0;
        
        // Position bonus 
        if (index === 0 || index === sentences.length - 1) {
            score += 0.5;
        }
        
        // Word frequency score
        words.forEach(word => {
            if (word.length > 3 && wordFreq[word]) {
                score += wordFreq[word];
            }
        });
        
        // Length penalty 
        const length = words.length;
        if (length < 5 || length > 30) {
            score *= 0.7;
        }
        
        scores.push(score);
    });

    return scores;
}

// Calculate word frequency
function calculateWordFrequency(text) {
    const stopWords = ['the', 'is', 'in', 'and', 'a', 'of', 'to', 'for', 'on', 'with', 'as', 'by', 'an', 'are', 'that', 'from', 'this', 'be', 'have', 'has', 'was', 'were', 'been', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const freq = {};
    
    words.forEach(word => {
        if (!stopWords.includes(word) && word.length > 3) {
            freq[word] = (freq[word] || 0) + 1;
        }
    });
    
    // Normalize frequencies
    const maxFreq = Math.max(...Object.values(freq));
    Object.keys(freq).forEach(word => {
        freq[word] = freq[word] / maxFreq;
    });
    
    return freq;
}

// top sentences based on scores
function getTopSentences(sentences, scores, count) {
    const sentenceData = sentences.map((sentence, index) => ({
        sentence: sentence.trim(),
        score: scores[index],
        originalIndex: index
    }));
    
    // Sort by score and take top sentences
    const topSentences = sentenceData
        .sort((a, b) => b.score - a.score)
        .slice(0, count);
    
    // Sort by original order to maintain coherence
    return topSentences
        .sort((a, b) => a.originalIndex - b.originalIndex)
        .map(item => item.sentence);
}

// Translation function using Free Google Translator RapidAPI
async function translateText(text, targetLang) {
    const url = `https://free-google-translator.p.rapidapi.com/external-api/free-google-translator?from=en&to=${targetLang}&query=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': CONFIG.TRANSLATION_API_KEY,
            'X-RapidAPI-Host': 'free-google-translator.p.rapidapi.com'
        }
    });

    if (!response.ok) {
        throw new Error(`Translation API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.data?.translatedText || result.translatedText || '';
}

// Mock translation for demonstration
function createMockTranslation(text, targetLang) {
    const languages = {
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'pt': 'Portuguese',
        'it': 'Italian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi'
    };

    return `[Mock ${languages[targetLang]} Translation]\n\n${text}\n\n[Note: This is a demonstration. Real translation requires API configuration.]`;
}

// Update insights section
function updateInsights(originalText, summaryText) {
    // Extract key findings
    const findings = extractKeyFindings(summaryText);
    updateList(keyFindings, findings);

    // Extracting keywords
    const keywordList = extractKeywords(summaryText);
    updateList(keywords, keywordList);
}

// Extracting key findings from text
function extractKeyFindings(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 5).map(s => s.trim());
}

// Extracting keywords from text
function extractKeywords(text) {
    const stopWords = ['the', 'is', 'in', 'and', 'a', 'of', 'to', 'for', 'on', 'with', 'as', 'by', 'an', 'are', 'that', 'from', 'this', 'be', 'have', 'has', 'was', 'were', 'been', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const freq = {};
    
    words.forEach(word => {
        if (!stopWords.includes(word) && word.length > 3) {
            freq[word] = (freq[word] || 0) + 1;
        }
    });
    
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);
}

// Updating list elements
function updateList(listElement, items) {
    listElement.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        listElement.appendChild(li);
    });
}

// Updating chart with text analysis
function updateChart(originalText, summaryText) {
    const ctx = document.getElementById('summaryChart').getContext('2d');
    
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
    }

    const originalWords = originalText.split(/\s+/).length;
    const summaryWords = summaryText.split(/\s+/).length;
    const compressionRatio = ((originalWords - summaryWords) / originalWords * 100).toFixed(1);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Original Text', 'Summary', 'Compression %'],
            datasets: [{
                label: 'Analysis',
                data: [originalWords, summaryWords, parseFloat(compressionRatio)],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(75, 192, 192, 0.6)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Text Analysis - ${compressionRatio}% compression achieved`
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

// File upload handler
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = function(e) {
            inputText.value = e.target.result;
        };
        reader.readAsText(file);
    } else {
        showAlert('Currently only .txt files are supported. PDF and DOCX support requires additional libraries.');
    }
}

// Export handlers
function handleExportPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Get content
    const originalText = document.getElementById('originalOutput').textContent;
    const summaryText = document.getElementById('summaryOutput').textContent;
    const translationText = document.getElementById('translationOutput').textContent;

    let y = 10;
    doc.setFontSize(16);
    doc.text('Academic Research Assistant', 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.text('Original Text:', 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(originalText, 180), 10, y);
    y += doc.getTextDimensions(doc.splitTextToSize(originalText, 180)).h + 6;

    doc.setFontSize(12);
    doc.text('Summary:', 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(summaryText, 180), 10, y);
    y += doc.getTextDimensions(doc.splitTextToSize(summaryText, 180)).h + 6;

    if (translationText) {
        doc.setFontSize(12);
        doc.text('Translation:', 10, y);
        y += 8;
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(translationText, 180), 10, y);
    }

    doc.save('summary.pdf');
}

function handleExportWord() {
    showAlert('Word export feature requires additional libraries.');
}

// Handle summarization errors
function handleSummarizationError(text) {
    try {
        const fallbackSummary = createExtractiveSummary(text);
        displaySummary(fallbackSummary);
        updateInsights(text, fallbackSummary);
        updateChart(text, fallbackSummary);
        showErrorMessage(summaryOutput, 'API summarization failed. Using extractive summary instead.');
    } catch (fallbackError) {
        console.error('Fallback summarization failed:', fallbackError);
        showErrorMessage(summaryOutput, 'Failed to summarize text. Please try again.');
    }
}

// UI Helper Functions
function displaySummary(summary) {
    summaryOutput.textContent = summary;
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Processing...';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent.replace('Processing...', 'Process');
    }
}

function showLoadingMessage(element, message) {
    element.innerHTML = `<div class="loading">${message}</div>`;
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = `✓ ${message}`;
    document.querySelector('main').insertBefore(successDiv, document.querySelector('main').firstChild);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

function showErrorMessage(element, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = `✗ ${message}`;
    element.innerHTML = '';
    element.appendChild(errorDiv);
}

function showAlert(message) {
    alert(message);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
    initializeEventListeners();
}