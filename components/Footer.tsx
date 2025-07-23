
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="text-center py-8 px-4 mt-12 border-t border-slate-800">
            <p className="text-sm text-slate-500">
                Longevity Priority Navigator &copy; {new Date().getFullYear()}. An AI-driven tool for accelerating longevity research.
            </p>
            <p className="text-xs text-slate-600 mt-2">
                Built to empower scientists and researchers in the field of aging.
            </p>
        </footer>
    );
};

export default Footer;