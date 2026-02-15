import { API_BASE_URL } from '../apiConfig';
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API_URL = API_BASE_URL;

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      axios.get(`${API_URL}/users/me`)
        .then(res => {
          setUser(res.data);
          localStorage.setItem('role', res.data.role);
        })
        .catch(err => {
          console.error("Failed to fetch user", err);
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token]);

  // Global 401 interceptor
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await axios.post(`${API_URL}/token`, params);
      const { access_token } = res.data;

      localStorage.setItem('token', access_token);
      setToken(access_token);

      const userRes = await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      const userData = userRes.data;
      localStorage.setItem('role', userData.role);
      setUser(userData);
      return userData.role;
    } catch (err) {
      console.error("Login failed", err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    delete axios.defaults.headers.common['Authorization'];
  };

  const signupMSME = async (data) => {
    const res = await axios.post(`${API_URL}/register`, data);
    const { access_token } = res.data;

    localStorage.setItem('token', access_token);
    setToken(access_token);

    const userRes = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const userData = userRes.data;
    localStorage.setItem('role', userData.role);
    setUser(userData);
    return userData.role;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, signupMSME, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
