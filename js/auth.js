// Authentication System for GKCCI Dashboard

// User management (localStorage for demo - replace with real backend)
class UserManager {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
    }

    loadUsers() {
        const stored = localStorage.getItem('gkcci_users');
        return stored ? JSON.parse(stored) : this.getDefaultUsers();
    }

    getDefaultUsers() {
        return [
            {
                id: 1,
                email: 'student.demo@uiowa.edu',
                password: 'demo123',
                firstName: 'Sarah',
                lastName: 'Johnson',
                university: 'University of Iowa',
                role: 'Law Student',
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                email: 'professor.demo@colgate.edu',
                password: 'demo123',
                firstName: 'Dr. Robert',
                lastName: 'Smith',
                university: 'Colgate University',
                role: 'Professor',
                createdAt: new Date().toISOString()
            }
        ];
    }

    saveUsers() {
        localStorage.setItem('gkcci_users', JSON.stringify(this.users));
    }

    loadCurrentUser() {
        const stored = localStorage.getItem('gkcci_current_user');
        return stored ? JSON.parse(stored) : null;
    }

    saveCurrentUser(user) {
        localStorage.setItem('gkcci_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    clearCurrentUser() {
        localStorage.removeItem('gkcci_current_user');
        this.currentUser = null;
    }

    findUserByEmail(email) {
        return this.users.find(user => user.email.toLowerCase() === email.toLowerCase());
    }

    createUser(userData) {
        const newUser = {
            id: this.users.length + 1,
            ...userData,
            createdAt: new Date().toISOString()
        };
        this.users.push(newUser);
        this.saveUsers();
        return newUser;
    }

    authenticateUser(email, password) {
        const user = this.findUserByEmail(email);
        if (user && user.password === password) {
            return { ...user };
        }
        return null;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize user manager
const userManager = new UserManager();

// Check if already logged in
document.addEventListener('DOMContentLoaded', function() {
    if (userManager.isLoggedIn()) {
        // Redirect to dashboard if already logged in
        window.location.href = 'index.html';
    }
});

// Tab switching
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn:first-child').classList.add('active');
}

function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('forgotForm').style.display = 'none';
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn:last-child').classList.add('active');
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'block';
}

// Demo account functionality
function fillDemoAccount(type) {
    if (type === 'student') {
        document.getElementById('loginEmail').value = 'student.demo@uiowa.edu';
        document.getElementById('loginPassword').value = 'demo123';
    } else if (type === 'professor') {
        document.getElementById('loginEmail').value = 'professor.demo@colgate.edu';
        document.getElementById('loginPassword').value = 'demo123';
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength');
    if (!strengthBar) return;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    strengthBar.className = 'password-strength';
    if (strength < 3) {
        strengthBar.classList.add('weak');
    } else if (strength < 5) {
        strengthBar.classList.add('medium');
    } else {
        strengthBar.classList.add('strong');
    }
}

// Event listeners for password strength
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('signupPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }
});

// Message display system
function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

// Loading overlay
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Login handler
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    showLoading();
    
    // Simulate API call delay
    setTimeout(() => {
        const user = userManager.authenticateUser(email, password);
        
        if (user) {
            // Remove password from stored user object
            const { password: _, ...userWithoutPassword } = user;
            userManager.saveCurrentUser(userWithoutPassword);
            
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showMessage('Invalid email or password', 'error');
        }
        
        hideLoading();
    }, 1000);
}

// Signup handler
async function handleSignup(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('signupEmail').value;
    const university = document.getElementById('university').value;
    const role = document.getElementById('role').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Validation
    if (!firstName || !lastName || !email || !university || !role || !password || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showMessage('Please agree to the Terms of Service', 'error');
        return;
    }
    
    // Check if user already exists
    if (userManager.findUserByEmail(email)) {
        showMessage('An account with this email already exists', 'error');
        return;
    }

    showLoading();
    
    // Simulate API call delay
    setTimeout(() => {
        try {
            const newUser = userManager.createUser({
                firstName,
                lastName,
                email,
                university,
                role,
                password
            });
            
            // Remove password and login the new user
            const { password: _, ...userWithoutPassword } = newUser;
            userManager.saveCurrentUser(userWithoutPassword);
            
            showMessage('Account created successfully! Redirecting...', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            
        } catch (error) {
            showMessage('Error creating account. Please try again.', 'error');
        }
        
        hideLoading();
    }, 1000);
}

// Forgot password handler
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotEmail').value;
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }
    
    const user = userManager.findUserByEmail(email);
    if (!user) {
        showMessage('No account found with this email address', 'error');
        return;
    }

    showLoading();
    
    // Simulate sending reset email
    setTimeout(() => {
        showMessage('Password reset instructions sent to your email', 'success');
        showLogin();
        hideLoading();
    }, 1500);
}

// Helper functions for links
function showTerms() {
    alert('Terms of Service\n\nThis is a research tool for the GKCCI privacy policy annotation project. By using this tool, you agree to:\n\n1. Use the tool only for research purposes\n2. Maintain confidentiality of research data\n3. Follow academic integrity guidelines\n4. Collaborate respectfully with other researchers');
}

function showPrivacy() {
    alert('Privacy Policy\n\nYour privacy is important to us. This tool:\n\n1. Stores annotation data locally for research purposes\n2. Does not share personal information with third parties\n3. Uses data only for GKCCI research collaboration\n4. Allows you to export and delete your data at any time\n5. Follows university data protection guidelines');
}

function showHelp() {
    alert('Help & Support\n\nGetting Started:\n\n1. Create an account with your university email\n2. Log in to access the annotation dashboard\n3. Upload your Label Studio JSON exports\n4. View and analyze annotation consistency\n5. Collaborate with other annotators\n\nFor technical support, contact:\n- Colgate University: your.supervisor@colgate.edu\n- University of Iowa: research.team@uiowa.edu');
}

function showContact() {
    alert('Contact Information\n\nGKCCI Research Project\n\nColgate University:\nDepartment of Computer Science\ncolgate.research@colgate.edu\n\nUniversity of Iowa:\nCollege of Law\nuiowa.research@uiowa.edu\n\nFor technical issues:\nsupport@gkcci-project.org');
}

function showAbout() {
    alert('About GKCCI Project\n\nThe GKCCI (Global Knowledge Commons for Constitutional Interpretation) Privacy Policy Analysis project is a collaboration between Colgate University and the University of Iowa.\n\nGoals:\n- Develop standardized privacy policy annotation framework\n- Create "gold standard" datasets for legal research\n- Improve inter-annotator agreement\n- Advance privacy law research methodologies\n\nThis dashboard helps law students and researchers collaborate on creating consistent, high-quality annotations of privacy policies using the 8-parameter GKCCI framework.');
}

// Export user management functions for use in main dashboard
window.UserAuth = {
    isLoggedIn: () => userManager.isLoggedIn(),
    getCurrentUser: () => userManager.getCurrentUser(),
    logout: () => {
        userManager.clearCurrentUser();
        window.location.href = 'login.html';
    },
    requireAuth: () => {
        if (!userManager.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
};

// Password validation
function validatePassword(password) {
    const requirements = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const score = Object.values(requirements).filter(Boolean).length;
    return { requirements, score, isValid: score >= 3 };
}

// Real-time password validation
document.addEventListener('DOMContentLoaded', function() {
    const signupPassword = document.getElementById('signupPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (signupPassword) {
        signupPassword.addEventListener('input', function() {
            const validation = validatePassword(this.value);
            checkPasswordStrength(this.value);
            
            // Show password requirements
            if (this.value.length > 0) {
                let tooltip = 'Password requirements:\n';
                tooltip += validation.requirements.length ? '✓' : '✗' + ' At least 8 characters\n';
                tooltip += validation.requirements.lowercase ? '✓' : '✗' + ' Lowercase letter\n';
                tooltip += validation.requirements.uppercase ? '✓' : '✗' + ' Uppercase letter\n';
                tooltip += validation.requirements.number ? '✓' : '✗' + ' Number\n';
                tooltip += validation.requirements.special ? '✓' : '✗' + ' Special character';
                
                this.title = tooltip;
            }
        });
    }
    
    if (confirmPassword) {
        confirmPassword.addEventListener('input', function() {
            const password = signupPassword.value;
            if (this.value && this.value !== password) {
                this.setCustomValidity('Passwords do not match');
                this.style.borderColor = '#ff6b6b';
            } else {
                this.setCustomValidity('');
                this.style.borderColor = '#e1e5e9';
            }
        });
    }
});

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// University email validation (optional enhancement)
function validateUniversityEmail(email, university) {
    const universityDomains = {
        'University of Iowa': ['uiowa.edu', 'hawkid.uiowa.edu'],
        'Colgate University': ['colgate.edu', 'mail.colgate.edu']
    };
    
    if (university && universityDomains[university]) {
        const domain = email.split('@')[1];
        return universityDomains[university].includes(domain);
    }
    
    return true; // Allow any email for other universities
}

// Form enhancement for better UX
document.addEventListener('DOMContentLoaded', function() {
    // Add floating labels effect
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.type !== 'checkbox') {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', function() {
                if (!this.value) {
                    this.parentElement.classList.remove('focused');
                }
            });
            
            // Check if input has value on page load
            if (input.value) {
                input.parentElement.classList.add('focused');
            }
        }
    });
    
    // Add keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            const form = e.target.closest('form');
            if (form) {
                const inputs = Array.from(form.querySelectorAll('input, select, button'));
                const currentIndex = inputs.indexOf(e.target);
                const nextInput = inputs[currentIndex + 1];
                
                if (nextInput && nextInput.tagName !== 'BUTTON') {
                    e.preventDefault();
                    nextInput.focus();
                }
            }
        }
    });
});

// Session management
function refreshSession() {
    if (userManager.isLoggedIn()) {
        // Extend session timestamp
        const user = userManager.getCurrentUser();
        user.lastActivity = new Date().toISOString();
        userManager.saveCurrentUser(user);
    }
}

// Refresh session every 5 minutes
setInterval(refreshSession, 5 * 60 * 1000);

// Check for session timeout (24 hours)
function checkSessionTimeout() {
    if (userManager.isLoggedIn()) {
        const user = userManager.getCurrentUser();
        const lastActivity = new Date(user.lastActivity || user.createdAt);
        const now = new Date();
        const hoursDiff = (now - lastActivity) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
            userManager.clearCurrentUser();
            showMessage('Session expired. Please log in again.', 'info');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
    }
}

// Check session timeout on page load and periodically
document.addEventListener('DOMContentLoaded', checkSessionTimeout);
setInterval(checkSessionTimeout, 10 * 60 * 1000); // Check every 10 minutes