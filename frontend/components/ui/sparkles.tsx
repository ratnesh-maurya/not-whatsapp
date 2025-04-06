import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Sparkle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
}

export function SparklesCore() {
    const [sparkles, setSparkles] = useState<Sparkle[]>([]);

    useEffect(() => {
        const generateSparkles = () => {
            const newSparkles: Sparkle[] = [];
            for (let i = 0; i < 50; i++) {
                newSparkles.push({
                    id: i,
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    size: Math.random() * 2 + 1,
                    duration: Math.random() * 2 + 1,
                });
            }
            setSparkles(newSparkles);
        };

        generateSparkles();
        const interval = setInterval(generateSparkles, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden">
            {sparkles.map((sparkle) => (
                <motion.div
                    key={sparkle.id}
                    className="absolute bg-white rounded-full"
                    style={{
                        width: sparkle.size,
                        height: sparkle.size,
                        left: `${sparkle.x}%`,
                        top: `${sparkle.y}%`,
                    }}
                    animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                    }}
                    transition={{
                        duration: sparkle.duration,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
} 