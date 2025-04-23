import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../public/newLogo.png';
import { useAuth } from '../../contexts/AuthContext';
import SvgLogo from '../../images/logo/aeco.svg';

const SignIn = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      setSuccess('Successfully signed in!');
      navigate('/');
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 p-5">
      <div className="w-full max-w-[900px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col md:flex-row">
          {/* Left Side - Form */}
          <div className="w-full p-8 md:w-1/2 md:p-12">
            <div className="mb-10 flex justify-center">
              <img src={SvgLogo} alt="Company Logo" className="h-20 w-auto" />
            </div>
            
            <h2 className="mb-2 text-center text-3xl font-bold text-gray-800">Welcome</h2>
            <p className="mb-8 text-center text-gray-600">Sign in to continue</p>
            
            <form onSubmit={signIn} className="space-y-6">
              <div>
                <span className="absolute mt-4 ml-4 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-full border border-gray-300 bg-gray-50 py-4 pl-12 pr-4 text-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              
              <div>
                <span className="absolute mt-4 ml-4 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-full border border-gray-300 bg-gray-50 py-4 pl-12 pr-4 text-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-500">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-500">
                  {success}
                </div>
              )}
              
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full transform rounded-full bg-gradient-to-r from-blue-500 to-purple-600 py-4 font-bold text-white transition duration-300 hover:from-blue-600 hover:to-purple-700 hover:shadow-lg disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'SIGN IN'
                  )}
                </button>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                <p>
                  Don't have an account?{' '}
                  <Link to="/auth/signup" className="font-medium text-blue-600 hover:text-blue-800">
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </div>
          
          {/* Right Side - Image and Text */}
          <div className="hidden w-1/2 bg-gradient-to-tr from-blue-600 to-purple-700 p-12 text-white md:block">
            <div className="flex h-full flex-col items-center justify-center">
              <img src={Logo} alt="Logo" className="mb-8 w-32" />
              <h2 className="mb-6 text-center text-3xl font-bold font-['Rakkas']" style={{ fontFamily: 'Rakkas, cursive' }}>شركة الطوارى العربية </h2>
              <p className="text-center text-lg">
                Manage your maintenance tickets efficiently and effectively
              </p>
              <div className="mt-10 flex justify-center space-x-4">
                <span className="flex h-3 w-3 rounded-full bg-white bg-opacity-50"></span>
                <span className="flex h-3 w-3 rounded-full bg-white"></span>
                <span className="flex h-3 w-3 rounded-full bg-white bg-opacity-50"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;