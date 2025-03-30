import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import GradientBackground from "@/components/GradientBackground";
import { motion } from "framer-motion";
import { fadeIn, cardAnimation } from "@/lib/animations";

export default function NotFound() {
  return (
    <GradientBackground>
      <div className="min-h-screen w-full flex items-center justify-center px-4">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeIn}
          className="w-full max-w-md"
        >
          <motion.div
            variants={cardAnimation}
            className="relative"
          >
            <Card className="bg-white rounded-xl shadow-xl p-6 w-full">
              <CardContent className="p-0">
                <div className="flex flex-col items-center text-center">
                  <AlertCircle className="h-16 w-16 text-purple-500 mb-4" />
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">404 Page Not Found</h1>
                  <p className="text-gray-600 mb-6">
                    The page you're looking for doesn't exist or has been moved.
                  </p>
                  <Link href="/">
                    <Button 
                      className="bg-gradient-to-r from-purple-800 to-purple-500 hover:from-purple-700 hover:to-purple-400 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300"
                    >
                      Go Back Home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </GradientBackground>
  );
}
