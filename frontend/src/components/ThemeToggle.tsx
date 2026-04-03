import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>(
        (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    );
    const [themeAware, setThemeAware] = useState(
        localStorage.getItem('themeAware') === 'true'
    );

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
        if (!themeAware) {
            setThemeAware(true);
            localStorage.setItem('themeAware', 'true');
        }
    };

    return (
        <div className="relative">
            <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-light border border-border text-secondary hover:text-primary hover:bg-border transition-all cursor-pointer relative"
                aria-label="Toggle theme"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                
                {/* Awareness indicator */}
                {!themeAware && theme === 'light' && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                )}
            </button>
            
            {/* Tooltip for awareness */}
            {!themeAware && theme === 'light' && (
                <div className="absolute right-0 top-full mt-2 w-max bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg shadow-indigo-500/20 animate-bounce pointer-events-none z-50">
                    Try dark mode!
                    <div className="absolute -top-1 right-3 w-2 h-2 bg-indigo-500 rotate-45"></div>
                </div>
            )}
        </div>
    );
}
