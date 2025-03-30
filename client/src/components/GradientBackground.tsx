import { useRef } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export default function GradientBackground({ children }: GradientBackgroundProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Base gradient background with animation */}
      <motion.div
        className="fixed inset-0 z-0"
        initial={{ 
          background: `
            linear-gradient(135deg, 
              rgba(191, 131, 255, 0.8) 0%, 
              rgba(157, 78, 221, 0.9) 25%,
              rgba(108, 43, 217, 1) 50%,
              rgba(93, 20, 159, 1) 100%)
          `
        }}
        animate={{ 
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
        }}
        transition={{ 
          duration: 30, 
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      {/* Content overlay */}
      <div className="relative z-10 min-h-screen">
        {children}
      </div>
    </div>
  );
}
