"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";

export const BackgroundBeams = () => {
    const ref = useRef(null);
    const isInView = useInView(ref);
    const controls = useAnimation();

    useEffect(() => {
        if (isInView) {
            controls.start("visible");
        }
    }, [isInView, controls]);

    return (
        <div ref={ref} className="absolute inset-0 z-0">
            <motion.div
                initial="hidden"
                animate={controls}
                variants={{
                    visible: { opacity: 1 },
                    hidden: { opacity: 0 },
                }}
                className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black"
            >
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-black/50"></div>
            </motion.div>
        </div>
    );
}; 