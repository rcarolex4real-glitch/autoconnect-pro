class AutoCareApp {
    constructor() {
        this.users = this.loadFromStorage('users') || [];
        this.currentUser = null;
        this.otpStorage = this.loadFromStorage('otpStorage') || {};
        this.appointments = this.loadFromStorage('appointments') || [];
        this.complaints = this.loadFromStorage('complaints') || [];
        this.chatHistory = [];
        
        this.init();
    }

    init() {
        this.showPage('login');
        this.setupEventListeners();
        this.setMinDateToToday();
    }

    // ===== STORAGE MANAGEMENT =====
    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    // ===== PAGE NAVIGATION =====
    showPage(pageName) {
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        
        const targetPage = document.getElementById(pageName + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
        }

        this.updateHeaderNav();
    }

    updateHeaderNav() {
        const loginBtn = document.getElementById('loginNavBtn');
        const signupBtn = document.getElementById('signupNavBtn');
        const headerNav = document.getElementById('headerNav');

        if (this.currentUser) {
            headerNav.innerHTML = `
                <span style="color: white; font-weight: 600;">Hi, ${this.currentUser.name}</span>
                <button class="nav-btn" onclick="app.handleLogout()">Logout</button>
            `;
        } else {
            headerNav.innerHTML = `
                <button class="nav-btn" onclick="app.showPage('login')">Login</button>
                <button class="nav-btn" onclick="app.showPage('signup')">Sign Up</button>
            `;
        }
    }

    // ===== AUTHENTICATION =====
    handleSignup(event) {
        event.preventDefault();
        
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim().toLowerCase();
        const phone = document.getElementById('signupPhone').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirm').value;
        const errorDiv = document.getElementById('signupError');

        errorDiv.style.display = 'none';

        // Validation
        if (password.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            this.showError(errorDiv, 'Passwords do not match');
            return;
        }

        // Check if email already exists
        if (this.users.some(user => user.email === email)) {
            this.showError(errorDiv, 'Email already registered. Please login instead.');
            return;
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            name,
            email,
            phone,
            password: this.hashPassword(password),
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveToStorage('users', this.users);

        this.showNotification('Account created successfully! Please login.', 'success');
        
        // Clear form and redirect to login
        document.getElementById('signupForm').reset();
        setTimeout(() => this.showPage('login'), 1500);
    }

    handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        errorDiv.style.display = 'none';

        const user = this.users.find(u => u.email === email);

        if (!user) {
            this.showError(errorDiv, 'Email not found. Please sign up first.');
            return;
        }

        if (!this.verifyPassword(password, user.password)) {
            this.showError(errorDiv, 'Incorrect password. Please try again.');
            return;
        }

        // Successful login
        this.currentUser = user;
        this.showNotification('Login successful!', 'success');
        document.getElementById('userGreeting').textContent = this.currentUser.name.split(' ')[0];
        
        setTimeout(() => this.showPage('dashboard'), 1500);
    }

    handleForgotPassword(event) {
        event.preventDefault();
        
        const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
        const errorDiv = document.getElementById('forgotError');
        const successDiv = document.getElementById('forgotSuccess');

        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        const user = this.users.find(u => u.email === email);

        if (!user) {
            this.showError(errorDiv, 'Email not found in our records.');
            return;
        }

        // Generate OTP
        const otp = this.generateOTP();
        this.otpStorage[email] = {
            otp,
            timestamp: Date.now(),
            attempts: 0
        };
        this.saveToStorage('otpStorage', this.otpStorage);

        // Simulate sending email
        this.showSuccess(successDiv, `OTP sent to ${email}`);
        this.logToConsole(`OTP for ${email}: ${otp}`);

        // Store email for next step
        sessionStorage.setItem('resetEmail', email);

        setTimeout(() => this.showPage('otp'), 2000);
    }

    handleOtpVerification(event) {
        event.preventDefault();
        
        const otpCode = document.getElementById('otpCode').value;
        const email = sessionStorage.getItem('resetEmail');
        const errorDiv = document.getElementById('otpError');

        errorDiv.style.display = 'none';

        if (!email || !this.otpStorage[email]) {
            this.showError(errorDiv, 'Session expired. Please try again.');
            return;
        }

        const otpData = this.otpStorage[email];

        // Check OTP expiration (10 minutes)
        if (Date.now() - otpData.timestamp > 10 * 60 * 1000) {
            this.showError(errorDiv, 'OTP expired. Please request a new one.');
            return;
        }

        // Check attempts
        if (otpData.attempts >= 3) {
            this.showError(errorDiv, 'Too many attempts. Please request a new OTP.');
            return;
        }

        if (otpData.otp !== otpCode) {
            otpData.attempts++;
            this.saveToStorage('otpStorage', this.otpStorage);
            this.showError(errorDiv, `Incorrect OTP. ${3 - otpData.attempts} attempts remaining.`);
            return;
        }

        // OTP verified
        this.showNotification('OTP verified!', 'success');
        setTimeout(() => this.showPage('newPassword'), 1500);
    }

    handleNewPassword(event) {
        event.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('newPasswordConfirm').value;
        const email = sessionStorage.getItem('resetEmail');
        const errorDiv = document.getElementById('newPassError');

        errorDiv.style.display = 'none';

        if (newPassword.length < 6) {
            this.showError(errorDiv, 'Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError(errorDiv, 'Passwords do not match');
            return;
        }

        // Find user and update password
        const user = this.users.find(u => u.email === email);
        if (user) {
            user.password = this.hashPassword(newPassword);
            this.saveToStorage('users', this.users);
        }

        // Clear OTP
        delete this.otpStorage[email];
        this.saveToStorage('otpStorage', this.otpStorage);
        sessionStorage.removeItem('resetEmail');

        this.showNotification('Password reset successfully!', 'success');
        setTimeout(() => this.showPage('login'), 1500);
    }

    handleLogout() {
        this.currentUser = null;
        this.chatHistory = [];
        document.getElementById('signupForm').reset();
        document.getElementById('loginForm').reset();
        this.showNotification('Logged out successfully!', 'success');
        setTimeout(() => this.showPage('login'), 1500);
    }

    // ===== APPOINTMENTS =====
    handleAppointment(event) {
        event.preventDefault();
        
        const brand = document.getElementById('selectedBrand').value;
        const serviceType = document.getElementById('serviceType').value;
        const date = document.getElementById('appointmentDate').value;
        const time = document.getElementById('appointmentTime').value;
        const notes = document.getElementById('appointmentNotes').value;
        const errorDiv = document.getElementById('appointmentError');
        const successDiv = document.getElementById('appointmentSuccess');

        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        if (!brand) {
            this.showError(errorDiv, 'Please select a car brand');
            return;
        }

        const appointment = {
            id: Date.now(),
            userId: this.currentUser.id,
            brand,
            serviceType,
            date,
            time,
            notes,
            status: 'Pending',
            createdAt: new Date().toISOString()
        };

        this.appointments.push(appointment);
        this.saveToStorage('appointments', this.appointments);

        this.showSuccess(successDiv, 'Appointment scheduled successfully! You will receive confirmation at your email.');
        
        setTimeout(() => {
            document.getElementById('appointmentForm').reset();
            document.getElementById('selectedBrand').value = '';
            this.closeModal('appointmentModal');
        }, 2000);
    }

    // ===== COMPLAINTS =====
    handleComplaint(event) {
        event.preventDefault();
        
        const type = document.getElementById('complaintType').value;
        const subject = document.getElementById('complaintSubject').value;
        const description = document.getElementById('complaintDescription').value;
        const priority = document.getElementById('complaintPriority').value;
        const errorDiv = document.getElementById('complaintError');
        const successDiv = document.getElementById('complaintSuccess');

        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        const complaint = {
            id: Date.now(),
            userId: this.currentUser.id,
            type,
            subject,
            description,
            priority,
            status: 'Submitted',
            createdAt: new Date().toISOString()
        };

        this.complaints.push(complaint);
        this.saveToStorage('complaints', this.complaints);

        this.showSuccess(successDiv, 'Complaint submitted successfully! We will review it shortly.');
        
        setTimeout(() => {
            document.getElementById('complaintForm').reset();
            this.closeModal('complaintModal');
        }, 2000);
    }

    // ===== CHAT =====
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        this.addChatMessage(message, 'user');
        input.value = '';

        // Simulate bot response
        setTimeout(() => {
            const response = this.generateBotResponse(message);
            this.addChatMessage(response, 'bot');
        }, 800);
    }

    addChatMessage(text, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = text;
        
        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.chatHistory.push({ sender, text, timestamp: new Date() });
    }

    generateBotResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();

        const responses = {
            greeting: [
                'Hello! How can I help you with your vehicle today?',
                'Hi there! What can I assist you with?',
                'Welcome! How may I be of service?'
            ],
            appointment: [
                'You can schedule an appointment by clicking the "Schedule Appointment" button on the dashboard.',
                'To book an appointment, select your car brand, service type, preferred date and time.',
                'Would you like to schedule an appointment? I can help you with that!'
            ],
            services: [
                'We offer various services including oil changes, tire replacement, battery service, brake service, engine check-ups, general maintenance, and AC service.',
                'Our services include maintenance, repairs, and inspections for all car brands.',
                'We provide comprehensive auto care services. What specific service do you need?'
            ],
            hours: [
                'We are open Monday to Friday from 9 AM to 6 PM, and Saturday from 10 AM to 4 PM.',
                'Our business hours are Mon-Fri: 9AM-6PM, Sat: 10AM-4PM.',
                'We\'re available during business hours: Mon-Fri 9AM-6PM and Saturday 10AM-4PM.'
            ],
            contact: [
                'You can reach us via email at support@autocare.com, WhatsApp at +1 (555) 123-4567, or call us at the same number.',
                'Contact us through email, phone, or WhatsApp. Check the Contact Info section for details.',
                'We\'re available on email, phone, and WhatsApp. Click Contact Info to reach us!'
            ],
            complaint: [
                'To file a complaint, click on "File Complaint" and provide details about your issue.',
                'You can submit a complaint through our app. We take all feedback seriously.',
                'Use the File Complaint feature to report any issues. We\'ll address them promptly.'
            ]
        };

        // Determine response category
        let category = 'greeting';
        
        if (lowerMessage.includes('appointment') || lowerMessage.includes('book') || lowerMessage.includes('schedule')) {
            category = 'appointment';
        } else if (lowerMessage.includes('service') || lowerMessage.includes('offer') || lowerMessage.includes('do you provide')) {
            category = 'services';
        } else if (lowerMessage.includes('hours') || lowerMessage.includes('when') || lowerMessage.includes('open')) {
            category = 'hours';
        } else if (lowerMessage.includes('contact') || lowerMessage.includes('reach') || lowerMessage.includes('number') || lowerMessage.includes('email')) {
            category = 'contact';
        } else if (lowerMessage.includes('complaint') || lowerMessage.includes('issue') || lowerMessage.includes('problem')) {
            category = 'complaint';
        }

        const categoryResponses = responses[category];
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    }

    // ===== MODAL MANAGEMENT =====
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        
        // Reset error/success messages
        const errorDiv = document.getElementById(modalId.replace('Modal', 'Error'));
        const successDiv = document.getElementById(modalId.replace('Modal', 'Success'));
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // ===== UTILITY FUNCTIONS =====
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    hashPassword(password) {
        // Simple hash for demo (not secure for production)
        return btoa(password);
    }

    verifyPassword(password, hash) {
        return btoa(password) === hash;
    }

    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }

    showSuccess(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        setTimeout(() => {
            notification.className = 'notification';
        }, 3000);
    }

    logToConsole(message) {
        console.log('%c' + message, 'color: #0066cc; font-weight: bold; font-size: 14px;');
    }

    setMinDateToToday() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('appointmentDate');
        if (dateInput) {
            dateInput.min = today;
        }
    }

    // ===== BRAND SELECTION =====
    setupEventListeners() {
        // Brand selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.brand-option')) {
                const option = e.target.closest('.brand-option');
                
                // Remove previous selection
                document.querySelectorAll('.brand-option').forEach(b => {
                    b.classList.remove('selected');
                });
                
                // Add selection to clicked option
                option.classList.add('selected');
                document.getElementById('selectedBrand').value = option.dataset.brand;
            }
        });

        // Chat input enter key
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.id === 'chatInput') {
                this.sendChatMessage();
            }
        });

        // Modal close on background click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });
    }
}

// Initialize app
const app = new AutoCareApp();