import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { Link, useNavigate } from 'react-router-dom';
import './auth.css';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters';
          break;
        default:
          errorMessage = 'Failed to create account. Please try again.';
      }
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Welcome to TIMIO</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSignup} className="auth-form">
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
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            className="auth-input"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="auth-button"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="loading-spinner" />
                Creating Account...
              </div>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        <div className="auth-links">
          <p>
            Already have an account? <Link to="/login">Sign in at timio.news</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;