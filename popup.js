'use strict';
//------------------------------------------------------------------------------
// popup.js
// Author: Pierre Lefaix
// Date: 2021/05/01
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// Constant declaration and definition
//------------------------------------------------------------------------------
// DOM elements
const OPEN_BUTTON = document.getElementById('openbutton');
const DOWNLOAD_BUTTON = document.getElementById('downloadbutton');
const PROGRESSBAR = document.getElementById('progressbar');
const STATUS_TEXT = document.getElementById('statustext');

// Strings
const BASE_URL = 'https://read.amazon.com/notebook';

//------------------------------------------------------------------------------
// Button events
//------------------------------------------------------------------------------
// OPEN_BUTTON click event
OPEN_BUTTON.addEventListener('click', function () {
    chrome.tabs.create({ url: BASE_URL });
});

// DOWNLOAD_BUTTON click event
DOWNLOAD_BUTTON.addEventListener('click', () => {
    STATUS_TEXT.textContent = 'Getting list of Kindle books...';
    // Step 1: Get all the Kindle books
    getBooks().then(async (books) => {
        // Step 2: Get all the highlights for each book
        for (let index = 0; index < books.length; index++) {
            let progess = ((index + 1) * 100) / books.length;
            STATUS_TEXT.textContent = `${progess.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })}
                        % - Getting highlights of "
                        ${books[index].title}" by ${books[index].authors}.`;
            await getHighlights(books[index]).then((highlights) => {
                books[index].highlights = highlights;
                console.log(books[index]);
                PROGRESSBAR.style.width = progess + '%';
            });
        }
        // Step 3: Download the result as a JSON file
        let blob = new Blob([JSON.stringify(books)], {
            type: 'application/json;charset=utf-8'
        });
        let objectURL = URL.createObjectURL(blob);
        let now = new Date();
        let filename =
            'content/' +
            now.getFullYear() +
            twoDigit(now.getMonth() + 1) +
            twoDigit(now.getDate()) +
            twoDigit(now.getHours()) +
            twoDigit(now.getMinutes()) +
            twoDigit(now.getSeconds()) +
            '_MyKindleHighliths.json';
        chrome.downloads.download({
            url: objectURL,
            filename: filename,
            conflictAction: 'overwrite'
        });
    });
});

//------------------------------------------------------------------------------
// Asynchronous functions
//------------------------------------------------------------------------------
// Load the BASE_URL and inject a script to get the Kindle books
async function getBooks() {
    return new Promise(function (resolve) {
        chrome.tabs.update({ url: BASE_URL }).then((tab) => {
            waitForTabLoad(tab.id, 5).then(() => {
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tab.id, allFrames: true },
                        function: getBooksDOM
                    },
                    (injectionResults) => {
                        resolve(injectionResults[0].result);
                    }
                );
            });
        });
    });
}

// Load the page related to a specific Kindle book (using ASIN) and inject a
// script to get the highlights of this book
async function getHighlights(book) {
    return new Promise(function (resolve) {
        const BOOKANNOTATION_URL =
            BASE_URL + '?asin=' + book.asin + '&contentLimitState=&';
        // Open the page with the highlights of a specific book
        console.log('Open ' + BOOKANNOTATION_URL);
        chrome.tabs.update({ url: BOOKANNOTATION_URL }).then((tab) => {
            waitForTabLoad(tab.id, 1).then(() => {
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tab.id, allFrames: true },
                        function: getHighlightsDOM
                    },
                    (injectionResults) => {
                        resolve(injectionResults[0].result);
                    }
                );
            });
        });
    });
}

//------------------------------------------------------------------------------
// DOM functions
//------------------------------------------------------------------------------
// Parse the current page for elements of class
// a-row kp-notebook-library-each-book and return an array of objects containing
// the books including their ASIN, their title, their authors, and an empty
// array for the highlights
function getBooksDOM() {
    const ARR = document.getElementsByClassName(
        'a-row kp-notebook-library-each-book'
    );
    let result = [];

    for (let i = 0; i < ARR.length; i++) {
        const ASIN = ARR[i].id;
        const TITLE = ARR[i].getElementsByTagName('h2')[0].innerText;
        const AUTHORS = ARR[i].getElementsByTagName('p')[0].innerText;
        const COVER = ARR[i].getElementsByTagName('img')[0].getAttribute('src');
        result.push({
            asin: ASIN,
            title: TITLE,
            authors: AUTHORS.replace('By: ', ''),
            cover: COVER,
            highlights: []
        });
    }
    return result;
}

// Parse the current page for elements with ids #highlight and
// #kp-annotation-location and return an array containing the highlights
// and their location
function getHighlightsDOM() {
    const ARR1 = document.querySelectorAll('#highlight');
    const ARR2 = document.querySelectorAll('#kp-annotation-location');
    let result = [];

    for (let i = 0; i < ARR1.length; i++) {
        result.push({
            highlight: ARR1[i].innerText,
            location: ARR2[i].value
        });
    }
    return result;
}

//------------------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------------------
// Wait for a specific tab to be loaded and for an additional amount of seconds
function waitForTabLoad(loadingTabId, seconds) {
    return new Promise(function (resolve) {
        chrome.tabs.onUpdated.addListener(function _listener(tabId, info, tab) {
            if (loadingTabId == tabId && tab.status == 'complete') {
                chrome.tabs.onUpdated.removeListener(_listener);
                setTimeout(function () {
                    resolve();
                }, seconds * 1000);
            }
        });
    });
}

// Return a two digit number
function twoDigit(n) {
    return (n < 10 ? '0' : '') + n;
}
