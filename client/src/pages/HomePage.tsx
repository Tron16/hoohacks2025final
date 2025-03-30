import { Link } from "wouter";
import { motion } from "framer-motion";
import GradientBackground from "@/components/GradientBackground";
import { fadeIn, staggerContainer, slideUp } from "@/lib/animations";

export default function HomePage() {
  
  return (
    <GradientBackground>
      <motion.div 
        className="min-h-screen flex flex-col"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Floating animated particles - reduced quantity and opacity */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 md:w-2 md:h-2 rounded-full bg-white opacity-20"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                x: [
                  Math.random() * window.innerWidth,
                  Math.random() * window.innerWidth,
                  Math.random() * window.innerWidth,
                ],
                y: [
                  Math.random() * window.innerHeight,
                  Math.random() * window.innerHeight,
                  Math.random() * window.innerHeight,
                ],
                scale: [0.8, 1.1, 0.8],
                opacity: [0.15, 0.25, 0.15],
              }}
              transition={{
                duration: 30 + Math.random() * 40,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>
        
        {/* Navbar */}
        <motion.nav 
          className="w-full px-4 py-3 md:px-8 md:py-5 flex justify-between items-center relative z-10"
          variants={fadeIn}
        >
          <Link href="/">
            <div className="flex items-center group">
              <motion.span 
                className="text-white text-xl md:text-2xl font-bold cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                un<span className="text-purple-300">mute</span>
              </motion.span>
              <motion.div
                className="ml-1 w-2 h-2 bg-purple-400 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </Link>
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link href="/signup">
              <motion.button 
                className="text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-all border border-white/20 backdrop-blur-sm"
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                Sign Up
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button 
                className="text-white bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full transition-all duration-300 backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Login
              </motion.button>
            </Link>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <motion.div 
          className="flex-grow flex flex-col items-center justify-center px-4 md:px-8 text-center relative z-10"
          variants={fadeIn}
        >
          <motion.h1 
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-4xl mx-auto"
            variants={slideUp}
          >
            We believe everyone deserves to be 
            <span className="text-purple-200"> heard</span> — on their own terms.
          </motion.h1>
          
          <motion.div 
            className="mt-8 md:mt-10 max-w-2xl mx-auto"
            variants={slideUp}
          >
            <p className="text-gray-300 text-lg md:text-xl backdrop-blur-sm rounded-lg p-4 bg-white/5">
              Unmute is a calling app designed for people with <span className="font-semibold text-gray-200">speech differences</span>. Whether you use 
              <span className="font-semibold text-gray-200"> text-to-speech</span>, <span className="font-semibold text-gray-200"> pre-typed phrases</span>, or <span className="font-semibold text-gray-200"> adaptive tools</span> — your voice matters.
            </p>
            
            <p className="text-gray-300 text-lg md:text-xl mt-6 backdrop-blur-sm rounded-lg p-4 bg-white/5">
              We're not here to change how you speak. We're here to help the world <span className="font-semibold text-gray-200">listen</span>.
            </p>
          </motion.div>
          
          <Link href="/login">
            <motion.button
              className="mt-10 md:mt-12 bg-white text-purple-700 font-semibold px-8 py-3 rounded-full text-lg shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden group"
              whileHover={{ 
                y: -3,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)"
              }}
              whileTap={{ scale: 0.95 }}
              variants={slideUp}
            >
              <span className="relative z-10">Get Started</span>
              <motion.span 
                className="absolute inset-0 bg-gradient-to-r from-purple-300 to-purple-100 opacity-0 group-hover:opacity-20 transition-all duration-500"
                initial={{ x: "-100%" }}
                whileHover={{ x: "0%" }}
                transition={{ type: "spring", stiffness: 50 }}
              />
            </motion.button>
          </Link>
          
          <motion.div 
            className="absolute bottom-8 left-0 right-0 flex justify-center opacity-80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8, y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <div className="flex flex-col items-center text-white">
              <p className="text-sm mb-2">Scroll to learn more</p>
              <motion.div 
                className="w-1 h-8 rounded-full bg-white bg-opacity-50"
                animate={{ scaleY: [0.3, 0.7, 0.3], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </GradientBackground>
  );
}
