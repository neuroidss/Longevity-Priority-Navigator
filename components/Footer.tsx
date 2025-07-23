
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="text-center py-8 px-4 mt-12 border-t border-slate-800">
            <p className="text-sm text-slate-500">
                A prototype developed for the <span className="font-semibold text-slate-400">Agentic AI x Longevity</span> Hackathon (July 2025).
            </p>
            <p className="text-xs text-slate-600 mt-2">
                Inspired by the work of Open Longevity, Gero, and Blastim.
            </p>
        </footer>
    );
};

export default Footer;
