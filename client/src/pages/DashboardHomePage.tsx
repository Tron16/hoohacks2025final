import React from 'react';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, History, Settings, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, cardAnimation } from '@/lib/animations';
import { useQuery } from '@tanstack/react-query';
import { UserResponse, CallHistoryResponse } from '@/types/api';

export default function DashboardHomePage() {
  const [location, setLocation] = useLocation();
  
  // Get user data
  const { data: userData, isLoading } = useQuery<UserResponse>({
    queryKey: ['/api/user'],
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  // Get call history summary
  const { data: callHistoryData } = useQuery<CallHistoryResponse>({
    queryKey: ['/api/call-history'],
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  const totalCalls = callHistoryData?.calls?.length || 0;
  
  const features = [
    {
      title: "Make a Call",
      description: "Start a new voice call with text to speech assistance",
      icon: <Phone className="h-8 w-8 text-purple-400" />,
      action: () => setLocation("/call"),
      buttonText: "Call Now"
    },
    {
      title: "Call History",
      description: `View your past calls (${totalCalls} total)`,
      icon: <History className="h-8 w-8 text-purple-400" />,
      action: () => setLocation("/call-history"),
      buttonText: "View History"
    },
    {
      title: "Voice Settings",
      description: "Customize voice models and speech settings",
      icon: <Settings className="h-8 w-8 text-purple-400" />,
      action: () => setLocation("/call"),
      buttonText: "Configure"
    }
  ];
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome{userData?.user ? `, ${userData.user.firstName}` : ''}!
          </h1>
          <p className="text-white text-opacity-80 mt-1">
            Unmute your voice with our text-to-speech calling solution
          </p>
        </div>
        
        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Phone className="h-5 w-5 mr-2 text-purple-400" />
                Total Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalCalls}</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Feature cards */}
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div 
              key={feature.title} 
              initial="hidden"
              animate="show"
              variants={cardAnimation}
              custom={index}
            >
              <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
                <CardHeader>
                  <div className="mb-2">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-white text-opacity-60">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button 
                    onClick={feature.action}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-400"
                  >
                    {feature.buttonText}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
        
        {/* Tips */}
        <div className="mt-12">
          <Card className="bg-white bg-opacity-5 border-white border-opacity-10">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Headphones className="h-5 w-5 mr-2 text-purple-400" />
                Tips for Better Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Speak clearly and at a moderate pace</li>
                <li>If calling a business, be prepared to use the keypad for menus</li>
                <li>Adjust voice settings for clarity on different types of calls</li>
                <li>Use higher speech speed for casual conversations, lower for important calls</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}