import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { Link, useNavigate } from 'react-router-dom';
import './auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', isLoggedIn: true });
        chrome.storage.local.set({ isLoggedIn: true });
        navigate('/Main');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const token = await user.getIdToken();
      chrome.storage.local.set({
        authToken: token,
        isLoggedIn: true,
        userId: user.uid
      });

      chrome.runtime.sendMessage({ 
        type: 'AUTH_STATE_CHANGED', 
        isLoggedIn: true 
      });

      navigate('/Main');
    } catch (error) {
      let errorMessage = '';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Invalid password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = 'Failed to login. Please try again.';
      }
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (error) {
      setError('Failed to send reset email. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Welcome to TIMIO</h2>
        {error && <div className="error-message">{error}</div>}
        {resetSent && (
          <div className="success-message">
            Password reset link sent! Please check your email.
          </div>
        )}
        <form onSubmit={handleLogin} className="auth-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="auth-input"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="auth-input"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="auth-button"
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => navigate('/signup')}
            className="auth-button auth-button-secondary"
          >
            Create Account
          </button>
        </form>
        <div className="auth-links">
          <button
            onClick={handleForgotPassword}
            className="forgot-password"
          >
            Forgot password?
          </button>
          <p className="signup-text">
            New user? <Link to="/signup" className="signup-link">Sign up at timio.news</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;