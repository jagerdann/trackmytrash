// API Base URL - change this to your Render URL
const API_BASE_URL = 'https://trackmytrash.onrender.com';

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    // NAVBAR MENU
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            navLinks.classList.toggle('show');
        });
        
        document.addEventListener('click', function(e) {
            if (navLinks.classList.contains('show')) {
                if (!navLinks.contains(e.target) && !hamburger.contains(e.target)) {
                    navLinks.classList.remove('show');
                }
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && navLinks.classList.contains('show')) {
                navLinks.classList.remove('show');
            }
        });
        
        const links = navLinks.querySelectorAll('a');
        links.forEach(function(link) {
            link.addEventListener('click', function() {
                navLinks.classList.remove('show');
            });
        });
    }
    
    // CONTACT FORM - Feedback
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                name: document.querySelector('input[placeholder="Your name"]')?.value || '',
                email: document.querySelector('input[placeholder="Your email"]')?.value || '',
                barangay: document.querySelector('select:nth-of-type(1)')?.value || '',
                feedback_type: document.querySelector('select:nth-of-type(2)')?.value || '',
                message: document.querySelector('textarea')?.value || ''
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/feedback`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                alert(result.message);
                
                if (result.success) {
                    feedbackForm.reset();
                }
            } catch(error) {
                alert('Connection error. Make sure the server is running.');
                console.error(error);
            }
        });
    }
    
    // REGISTER FORM
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                username: document.getElementById('username')?.value || '',
                email: document.getElementById('email')?.value || '',
                password: document.getElementById('password')?.value || '',
                barangay: document.getElementById('barangay')?.value || '',
                contact: document.getElementById('contact')?.value || ''
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                alert(result.message);
                
                if (result.success) {
                    window.location.href = `${API_BASE_URL}/Login.html`;
                }
            } catch(error) {
                alert('Connection error. Make sure the server is running.');
                console.error(error);
            }
        });
    }
    
    // LOGIN FORM
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                username: document.getElementById('username')?.value || '',
                password: document.getElementById('password')?.value || ''
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (result.success === true) {
                    alert('✅ ' + result.message);
                    
                    if (result.is_admin === true) {
                        window.location.href = `${API_BASE_URL}/AdminPage.html`;
                    } else {
                        window.location.href = `${API_BASE_URL}/LandingPage.html`;
                    }
                } else {
                    alert('❌ ' + result.message);
                }
            } catch(error) {
                alert('❌ Connection error: ' + error);
                console.error(error);
            }
        });
    }
    
    // SCROLL BUTTON
    initScrollButton();
});

// Check admin session (for admin page)
async function checkAdminSession() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check_session`, {
            method: 'GET',
            credentials: 'include'
        });
        const result = await response.json();
        
        if (result.logged_in && result.is_admin) {
            document.getElementById('welcomeAdmin').innerHTML = `Welcome, ${result.username}! 👑`;
            if (typeof loadUsers === 'function') loadUsers();
        } else {
            window.location.href = `${API_BASE_URL}/Login.html`;
        }
    } catch(error) {
        console.error('Session check failed:', error);
        window.location.href = `${API_BASE_URL}/Login.html`;
    }
}

// Load areas for registration
async function loadAreas() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/routes/areas`);
        const data = await response.json();
        const select = document.getElementById('barangay');
        
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Select your area</option>';
            if (data.success && data.areas) {
                data.areas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    select.appendChild(option);
                });
            }
        }
    } catch(error) {
        console.error('Failed to load areas:', error);
    }
}

// ========== SCHEDULE DATA (from database) ==========
let baseSchedules = [];
let daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Load schedules from database - PUBLIC endpoint
async function loadSchedulesFromDB() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/public/routes`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();
        
        console.log("Routes loaded:", data);
        
        if (data.success && data.routes && data.routes.length > 0) {
            baseSchedules = data.routes.map(route => ({
                stopNo: route.stop_no,
                area: route.area,
                arrivalTime: route.arrival_time,
                duration: parseInt(route.duration),
                route_image: route.route_image
            }));
            console.log("Schedules loaded from database:", baseSchedules.length);
        } else {
            console.log("No routes found, using defaults");
            baseSchedules = [
                { stopNo: 1, area: "Holy Cross / San Bartolome Proper", arrivalTime: "6:00 AM", duration: 25 },
                { stopNo: 2, area: "Greenheights Subdivision", arrivalTime: "6:35 AM", duration: 20 },
                { stopNo: 3, area: "Goodwill Homes 1", arrivalTime: "7:15 AM", duration: 25 },
                { stopNo: 4, area: "Kingspoint Subdivision", arrivalTime: "7:50 AM", duration: 20 },
                { stopNo: 5, area: "Grand Monaco II / Richland", arrivalTime: "8:20 AM", duration: 25 },
                { stopNo: 6, area: "Goodwill Homes 2", arrivalTime: "8:55 AM", duration: 20 },
                { stopNo: 7, area: "Bagbag", arrivalTime: "9:25 AM", duration: 25 }
            ];
        }
    } catch(error) {
        console.error("Failed to load schedules:", error);
    }
}

function getCurrentDay() {
    const now = new Date();
    const phTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[phTime.getDay()];
}

function getScheduleForDay(dayName) {
    if (baseSchedules.length === 0) return [];
    
    const dayIndex = daysOrder.indexOf(dayName);
    if (dayIndex === -1) return baseSchedules;
    
    const rotated = [...baseSchedules];
    for (let i = 0; i < dayIndex; i++) {
        rotated.push(rotated.shift());
    }
    
    let currentMinutes = 6 * 60;
    return rotated.map((s, idx) => {
        const arrivalHours = Math.floor(currentMinutes / 60);
        const arrivalMins = currentMinutes % 60;
        const period = arrivalHours >= 12 ? 'PM' : 'AM';
        let displayHour = arrivalHours % 12;
        if (displayHour === 0) displayHour = 12;
        const arrivalStr = `${displayHour}:${arrivalMins.toString().padStart(2, '0')} ${period}`;
        
        const durationMinutes = typeof s.duration === 'number' ? s.duration : parseInt(s.duration);
        const departureMinutes = currentMinutes + durationMinutes;
        currentMinutes = departureMinutes + 5;
        
        return {
            ...s,
            stopNo: idx + 1,
            arrivalTime: arrivalStr,
            day: dayName,
            originalArrivalTime: s.arrivalTime
        };
    });
}

// ========== CLOSE POPUP ==========
function closePopup() {
    const popup = document.getElementById('customPopup');
    if (popup) popup.style.display = 'none';
}

// ========== SHOW MISSED TRUCK POPUP ==========
function showMissedTruckPopup(message, date, time, area) {
    const popup = document.getElementById('customPopup');
    const popupMessage = document.getElementById('popupMessage');
    const popupDate = document.getElementById('popupDate');
    const popupTime = document.getElementById('popupTime');
    const popupArea = document.getElementById('popupArea');
    const popupHeader = document.querySelector('.popup-header h3');
    
    if (popupMessage) {
        popupMessage.innerHTML = message;
        popupMessage.style.fontSize = "1.2em";
    }
    if (popupDate) {
        popupDate.innerHTML = date;
        popupDate.parentElement.style.display = 'block';
    }
    if (popupTime) {
        popupTime.innerHTML = time;
        popupTime.parentElement.style.display = 'block';
    }
    if (popupArea) {
        popupArea.innerHTML = area;
        popupArea.parentElement.style.display = 'block';
    }
    if (popupHeader) popupHeader.innerHTML = "🚛 TRACK MY TRASH";
    
    if (popup) popup.style.display = 'flex';
}

// ========== SHOW WELCOME POPUP (MOBILE ONLY) ==========
function showWelcomePopup(username) {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const popup = document.getElementById('customPopup');
        const popupMessage = document.getElementById('popupMessage');
        const popupDate = document.getElementById('popupDate');
        const popupTime = document.getElementById('popupTime');
        const popupArea = document.getElementById('popupArea');
        const popupHeader = document.querySelector('.popup-header h3');
        
        if (popupMessage) {
            popupMessage.innerHTML = `🎉 WELCOME TO TRACK MY TRASH, ${username}! 🎉`;
            popupMessage.style.fontSize = "1.1em";
        }
        if (popupDate) popupDate.parentElement.style.display = 'none';
        if (popupTime) popupTime.parentElement.style.display = 'none';
        if (popupArea) popupArea.parentElement.style.display = 'none';
        if (popupHeader) popupHeader.innerHTML = "🎊 WELCOME! 🎊";
        
        if (popup) {
            popup.style.display = 'flex';
        }
        
        setTimeout(() => {
            closePopup();
        }, 3000);
    }
}

// ========== DISPLAY SCHEDULE ==========
async function displaySchedule() {
    try {
        if (baseSchedules.length === 0) {
            await loadSchedulesFromDB();
        }
        
        const currentDay = getCurrentDay();
        const schedules = getScheduleForDay(currentDay);
        
        console.log("Schedules for day:", schedules);
        
        let userArea = null;
        const sessionResponse = await fetch(`${API_BASE_URL}/api/check_session`, {
            method: 'GET',
            credentials: 'include'
        });
        const sessionResult = await sessionResponse.json();
        
        if (sessionResult.logged_in && !sessionResult.is_admin) {
            const userResponse = await fetch(`${API_BASE_URL}/api/user/${sessionResult.username}`, {
                method: 'GET',
                credentials: 'include'
            });
            const userData = await userResponse.json();
            userArea = userData.user?.barangay;
            console.log("User area:", userArea);
        }
        
        let userSchedule = null;
        let areaName = "Bagbag";
        
        if (userArea && schedules.length > 0) {
            userSchedule = schedules.find(s => s.area === userArea);
            
            if (!userSchedule) {
                userSchedule = schedules.find(s => 
                    s.area.toLowerCase().includes(userArea.toLowerCase()) || 
                    userArea.toLowerCase().includes(s.area.toLowerCase())
                );
            }
        }
        
        if (!userSchedule && schedules.length > 0) {
            userSchedule = schedules[0];
        }
        
        if (userSchedule) {
            areaName = userSchedule.area.split(' / ')[0];
        }
        
        let imageFile = "BAGBAG.PNG";
        if (userSchedule && userSchedule.route_image) {
            imageFile = userSchedule.route_image;
        }
        
        const today = new Date();
        const phTime = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const todayDate = `${months[phTime.getMonth()]} ${phTime.getDate()}, ${phTime.getFullYear()}`;
        
        let isArrivalPassed = false;
        let nextPickupDate = "";
        let nextPickupTime = "";
        
        if (userSchedule) {
            const arrivalTime = userSchedule.originalArrivalTime || userSchedule.arrivalTime;
            const arrivalHour = parseInt(arrivalTime.split(':')[0]);
            const arrivalMinute = parseInt(arrivalTime.split(':')[1].split(' ')[0]);
            const isPM = arrivalTime.includes('PM');
            let arrivalHour24 = arrivalHour;
            if (isPM && arrivalHour !== 12) arrivalHour24 += 12;
            if (!isPM && arrivalHour === 12) arrivalHour24 = 0;
            
            const currentHour = phTime.getHours();
            const currentMinute = phTime.getMinutes();
            
            isArrivalPassed = (currentHour > arrivalHour24) || 
                (currentHour === arrivalHour24 && currentMinute > arrivalMinute);
            
            const tomorrowIndex = (daysOrder.indexOf(currentDay) + 1) % 7;
            const tomorrow = daysOrder[tomorrowIndex];
            const tomorrowSchedule = getScheduleForDay(tomorrow);
            
            const nextSchedule = tomorrowSchedule.find(s => s.area === userSchedule.area);
            
            if (nextSchedule) {
                nextPickupTime = nextSchedule.originalArrivalTime || nextSchedule.arrivalTime;
                const tomorrowDate = new Date(phTime);
                tomorrowDate.setDate(phTime.getDate() + 1);
                nextPickupDate = `${months[tomorrowDate.getMonth()]} ${tomorrowDate.getDate()}, ${tomorrowDate.getFullYear()}`;
            }
        }
        
        if (isArrivalPassed && userSchedule) {
            showMissedTruckPopup(
                "🚛 You missed the garbage truck arrival!",
                nextPickupDate,
                nextPickupTime,
                areaName
            );
        }
        
        const arrivalEl = document.querySelector('.arrival-time-large');
        if (arrivalEl) {
            arrivalEl.innerHTML = `
                <div class="arrival-date">${todayDate}</div>
                <div class="arrival-day-large">${currentDay.toUpperCase()}</div>
                <div class="next-pickup-info">
                    <span class="next-pickup-label">NEXT GARBAGE PICK UP:</span>
                    <span class="next-pickup-datetime">${nextPickupDate} at ${nextPickupTime}</span>
                </div>
            `;
        }
        
        const container = document.getElementById('scheduleNotification');
        if (!container) return;
        
        container.innerHTML = `
            <div class="area-highlight">${areaName}</div>
            <div class="route-image">
                <img src="../img/${imageFile}" alt="Route Map for ${areaName}" class="route-img">
            </div>
        `;
    } catch(error) {
        console.error("Display schedule error:", error);
    }
}

// ========== CHECK SESSION ==========
async function checkSession() {
    try {
        await loadSchedulesFromDB();
        
        const response = await fetch(`${API_BASE_URL}/api/check_session`, {
            method: 'GET',
            credentials: 'include'
        });
        const result = await response.json();
        
        const homeh1 = document.getElementById('homeh1');
        const loginBtn = document.getElementById('loginButton');
        const logoutDesktop = document.getElementById('logoutBtnDesktop');
        const logoutMobile = document.getElementById('logoutBtnMobile');
        const scheduleSection = document.getElementById('scheduleSection');
        
        if (result.logged_in) {
            if (homeh1) homeh1.innerHTML = `WELCOME TO TRACK MY TRASH, ${result.username}! 🚛`;
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutDesktop) logoutDesktop.style.display = 'inline-block';
            if (logoutMobile) logoutMobile.style.display = 'block';
            if (scheduleSection) scheduleSection.style.display = 'block';
            
            showWelcomePopup(result.username);
            displaySchedule();
        } else {
            if (homeh1) homeh1.innerHTML = `WELCOME TO TRACK MY TRASH`;
            if (loginBtn) loginBtn.style.display = 'block';
            if (logoutDesktop) logoutDesktop.style.display = 'none';
            if (logoutMobile) logoutMobile.style.display = 'none';
            if (scheduleSection) scheduleSection.style.display = 'none';
        }
    } catch(error) {
        console.error('Session check failed:', error);
    }
}

// ========== SCROLL BUTTON ==========
function initScrollButton() {
    const scrollBtn = document.getElementById('scroll');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        });
    }
}

// Check if on HomePage and user is logged in
async function checkHomePageRedirect() {
    const isHomePage = window.location.pathname.includes('HomePage.html') || window.location.pathname === '/' || window.location.pathname === '/HomePage.html';
    
    if (isHomePage) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/check_session`, {
                method: 'GET',
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.logged_in) {
                window.location.href = `${API_BASE_URL}/LandingPage.html`;
            }
        } catch(error) {
            console.error('Session check failed:', error);
        }
    }
}

// Call this when page loads
checkHomePageRedirect();

//dito nagstart yung application 

// ========== PWA INSTALL PROMPT (with engagement tracking) ==========
let deferredPrompt;
let engagementMet = false;
let startTime = Date.now();
let engagementChecked = false;

// Function para ipakita ang custom banner
function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) {
    banner.style.display = 'flex';
    console.log('Install banner shown');
  }
}

function hideInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.style.display = 'none';
}

// Suriin kung dismissed na ng user
function isInstallDismissed() {
  const dismissedUntil = localStorage.getItem('pwaInstallDismissed');
  if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
    console.log('Install banner dismissed until:', new Date(dismissedUntil));
    return true;
  }
  return false;
}

// Suriin kung pwedeng magpakita ng banner
function checkAndShowBanner() {
  // Kung na-dismiss na, huwag ipakita
  if (isInstallDismissed()) return;
  
  // Kunin ang engagement status mula localStorage
  const hasClicked = localStorage.getItem('pwaUserClicked') === 'true';
  const hasSpent30s = localStorage.getItem('pwaUserSpent30s') === 'true';
  
  console.log('Engagement check:', { hasClicked, hasSpent30s, hasPrompt: !!deferredPrompt });
  
  // Kung na-meet ang engagement at may prompt, ipakita ang banner
  if (hasClicked && hasSpent30s && deferredPrompt && !engagementChecked) {
    engagementChecked = true;
    showInstallBanner();
  }
}

// I-track ang pag-click ng user (kahit saan sa page)
function trackUserClick() {
  if (localStorage.getItem('pwaUserClicked') === 'true') return;
  
  console.log('User clicked - engagement started');
  localStorage.setItem('pwaUserClicked', 'true');
  startTime = Date.now();
  checkAndShowBanner();
}

// I-track ang 30 seconds na pag-stay sa page
function startEngagementTimer() {
  const interval = setInterval(() => {
    const hasSpent30s = localStorage.getItem('pwaUserSpent30s') === 'true';
    if (hasSpent30s) {
      clearInterval(interval);
      return;
    }
    
    const secondsSpent = Math.floor((Date.now() - startTime) / 1000);
    if (secondsSpent >= 30) {
      console.log('User spent 30 seconds on page');
      localStorage.setItem('pwaUserSpent30s', 'true');
      checkAndShowBanner();
      clearInterval(interval);
    }
  }, 1000);
}

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event fired!');
  e.preventDefault();
  deferredPrompt = e;
  
  // Kapag may prompt na, i-check kung pwedeng magpakita ng banner
  checkAndShowBanner();
});

// I-setup ang lahat ng PWA-related pagkatapos mag-load ng DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - setting up PWA install');
  
  // I-attach ang click tracking sa buong document
  document.body.addEventListener('click', trackUserClick, { once: true });
  
  // Simulan ang timer para sa engagement
  startEngagementTimer();
  
  // I-setup ang install button
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      console.log('Install button clicked');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome} the installation`);
        deferredPrompt = null;
      }
      hideInstallBanner();
    });
  } else {
    console.log('Install button not found in DOM');
  }
  
  // I-setup ang dismiss button
  const dismissBtn = document.getElementById('dismissBtn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      console.log('Dismiss button clicked');
      hideInstallBanner();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
      localStorage.setItem('pwaInstallDismissed', expiryDate.toISOString());
    });
  } else {
    console.log('Dismiss button not found in DOM');
  }
});

//dito nag end 

// ========== LOGOUT ==========
async function logout() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        const result = await response.json();
        alert(result.message);
        window.location.href = `${API_BASE_URL}/HomePage.html`;
    } catch(error) {
        alert('Logout failed. Please try again.');
        console.error(error);
    }
}