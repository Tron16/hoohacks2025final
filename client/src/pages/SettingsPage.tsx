import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  
  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated.",
    });
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-white text-opacity-80 mt-1">
            Customize your Unmute experience
          </p>
        </div>
        
        <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription className="text-white text-opacity-60">
              Manage your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName" 
                  placeholder="Your first name" 
                  className="bg-white bg-opacity-20 border-white border-opacity-20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  placeholder="Your last name" 
                  className="bg-white bg-opacity-20 border-white border-opacity-20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="Your email address" 
                className="bg-white bg-opacity-20 border-white border-opacity-20"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
          <CardHeader>
            <CardTitle>Default Voice Settings</CardTitle>
            <CardDescription className="text-white text-opacity-60">
              Set your preferred voice model and speech settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultVoice">Default Voice Model</Label>
              <Select defaultValue="nova">
                <SelectTrigger id="defaultVoice" className="bg-white bg-opacity-20 border-white border-opacity-20">
                  <SelectValue placeholder="Select voice model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultSpeed">Default Speech Speed</Label>
              <Select defaultValue="1.0">
                <SelectTrigger id="defaultSpeed" className="bg-white bg-opacity-20 border-white border-opacity-20">
                  <SelectValue placeholder="Select speech speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x (Slow)</SelectItem>
                  <SelectItem value="0.8">0.8x (Moderate slow)</SelectItem>
                  <SelectItem value="1.0">1.0x (Normal)</SelectItem>
                  <SelectItem value="1.2">1.2x (Moderate fast)</SelectItem>
                  <SelectItem value="1.5">1.5x (Fast)</SelectItem>
                  <SelectItem value="2.0">2.0x (Very fast)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription className="text-white text-opacity-60">
              Control how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Call Notifications</h3>
                <p className="text-sm text-white text-opacity-60">
                  Receive notifications for incoming and missed calls
                </p>
              </div>
              <Switch defaultChecked id="call-notifications" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Email Notifications</h3>
                <p className="text-sm text-white text-opacity-60">
                  Receive email updates about your account
                </p>
              </div>
              <Switch id="email-notifications" />
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button 
            className="bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500"
            onClick={handleSave}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}