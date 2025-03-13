import { useLanguage } from '../../contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { isArabic, toggleLanguage } = useLanguage();

  return (
    <li>
      <button
        onClick={toggleLanguage}
        className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 font-medium text-black hover:bg-gray-200 dark:bg-boxdark-2 dark:text-white dark:hover:bg-boxdark"
      >
        <span>{isArabic ? 'EN' : 'عربي'}</span>
      </button>
    </li>
  );
};

export default LanguageSwitcher;
