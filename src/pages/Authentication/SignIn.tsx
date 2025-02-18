import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../public/newLogo.png';
import { useAuth } from '../../contexts/AuthContext';

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
    <div className="flex min-h-screen">
      {/* Left Side - Image */}
      <div className="hidden w-1/2 bg-graydark lg:block">
        <div className="flex h-full flex-col items-center justify-center px-20 text-white">
          <img src={Logo} alt="Logo" className=" w-96" />
          <h2 className="mb-4 text-3xl font-bold">شركة الطوارى العربية للسلامة</h2>
          <p className="text-center text-lg">
            Manage your maintenance tickets efficiently and effectively
          </p>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="w-full lg:w-1/2">
        <div className="flex h-full flex-col items-center justify-center px-10 py-20 sm:px-20">
          <div className="w-full max-w-[440px]">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-black dark:text-white">
                Welcome
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Please sign in to continue
              </p>
            </div>

            <form onSubmit={signIn}>
              <div className="mb-6">
                <label className="mb-2.5 block text-black dark:text-white">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-stroke bg-transparent py-4 pl-6 pr-10 outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              <div className="mb-6">
                <label className="mb-2.5 block text-black dark:text-white">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-stroke bg-transparent py-4 pl-6 pr-10 outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-500 dark:bg-red-500/10">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-500 dark:bg-green-500/10">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-primary p-4 text-white transition hover:bg-opacity-90 disabled:bg-opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;