
import React, { useState, useEffect } from 'react';

const QUOTES = [
    {
        text: "Genius is the art of discerning what truly matters and dedicating your time to it.",
        author: "Guiding Principle"
    },
    {
        text: "I often wonder about the questions we don't yet know how to ask... because the questions we know how to ask, I'm not so interested in them.",
        author: "Neil deGrasse Tyson"
    },
    {
        text: "The victim of mind-manipulation does not know he is a victim. To him, the walls of his prison are invisible, and he believes himself to be free.",
        author: "Aldous Huxley"
    },
    {
        text: "Always listen to experts. They'll tell you what can't be done and why. Then do it.",
        author: "Robert Heinlein"
    }
];


const Header: React.FC = () => {
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentQuoteIndex(prevIndex => (prevIndex + 1) % QUOTES.length);
        }, 7000); // Change quote every 7 seconds
        return () => clearInterval(timer);
    }, []);

    const currentQuote = QUOTES[currentQuoteIndex];

    return (
        <>
            <header className="py-8 px-4 flex flex-col items-center gap-6">
                <div className="text-center">
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-blue-500">
                        Longevity Priority Navigator
                    </h1>
                    <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
                        An AI navigator for aging research. We help you cut through the noise to find the signal—the critical questions and high-impact research directions that can accelerate the science of longevity.
                    </p>
                </div>
                <div className="mt-4 max-w-2xl mx-auto text-center h-24 flex items-center justify-center">
                    <div key={currentQuoteIndex} className="animate-fade-in w-full">
                        <p className="text-md text-slate-500 italic">"{currentQuote.text}"</p>
                        <footer className="mt-2 text-sm text-slate-600">- {currentQuote.author}</footer>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
