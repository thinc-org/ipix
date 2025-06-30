import { UserCircle, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);

    if (newTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="w-screen bg-white dark:bg-neutral-800 border-b h-[10vh] border-gray-200 dark:border-neutral-700">
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center">
          {isDark ? (
            <img
              src="/base_resource/ipix_logo_white.svg"
              alt="ipix"
              className="h-18 w-auto"
            />
          ) : (
            <img
              src="/base_resource/ipix_logo_red.svg"
              alt="ipix"
              className="h-18 w-auto"
            />
          )}
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-gray-600" />
            )}
          </button>

          <UserCircle className="h-8 w-8 transition-colors cursor-pointer" />
        </div>
      </div>
    </header>
  );
}
