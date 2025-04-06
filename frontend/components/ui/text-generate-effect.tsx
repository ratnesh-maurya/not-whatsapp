"use client";

import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

export const TextGenerateEffect = ({
    words,
    className,
}: {
    words: string;
    className?: string;
}) => {
    const wordsArray = words.split(" ");

    return (
        <div className={cn("font-bold", className)}>
            <div className="mt-4">
                <div className="text-black dark:text-white text-2xl leading-snug tracking-wide">
                    {wordsArray.map((word, idx) => {
                        return (
                            <motion.span
                                key={word + idx}
                                className="text-gray-400"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                    duration: 0.5,
                                    delay: idx * 0.1,
                                }}
                            >
                                {word}{" "}
                            </motion.span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}; 