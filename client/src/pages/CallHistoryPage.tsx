import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Phone, Clock, Calendar, MessageSquare, FileText, X, Trash2 } from 'lucide-react';
import { format, formatDistance } from 'date-fns';
import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/animations';
import { CallHistoryResponse, CallHistoryItem, TranscriptMessage } from '@/types/api';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from "@/hooks/use-toast";

export default function CallHistoryPage() {
  // State for dialogs
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toast for notifications
  const { toast } = useToast();
  
  // Query client for invalidating queries
  const queryClient = useQueryClient();
  
  // Fetch call history from API
  const { data, isLoading, error } = useQuery<CallHistoryResponse>({
    queryKey: ['/api/call-history'],
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  const callHistory = data?.calls || [];
  
  // Handle deleting a call
  const handleDeleteCall = async () => {
    if (!selectedCall) return;
    
    try {
      setIsDeleting(true);
      
      await apiRequest(`/api/call-history/${selectedCall.id}`, {
        method: 'DELETE',
      });
      
      // Close the dialog
      setIsDeleteDialogOpen(false);
      
      // Reset selected call
      setSelectedCall(null);
      
      // Invalidate the call history query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/call-history'] });
      
      // Show success toast
      toast({
        title: "Call deleted",
        description: "Call has been deleted from your history.",
      });
    } catch (error) {
      console.error("Error deleting call:", error);
      toast({
        title: "Failed to delete call",
        description: "There was a problem deleting the call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Function to format duration in minutes and seconds
  const formatDuration = (startTime: string, endTime?: string) => {
    if (!startTime || !endTime) return "N/A";
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };
  
  // Format phone number for display
  const formatPhoneNumber = (phoneNumber: string) => {
    // Extract the last 10 digits for formatting
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    
    if (match) {
      return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
    }
    
    // Return the original number if it doesn't match the expected format
    return phoneNumber;
  };
  
  // Group calls by time period (today, this week, earlier)
  const organizeCallsByPeriod = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const todayCalls: CallHistoryItem[] = [];
    const thisWeekCalls: CallHistoryItem[] = [];
    const earlierCalls: CallHistoryItem[] = [];
    
    for (const call of callHistory) {
      const callDate = new Date(call.startTime);
      
      if (callDate >= today) {
        todayCalls.push(call);
      } else if (callDate >= oneWeekAgo) {
        thisWeekCalls.push(call);
      } else {
        earlierCalls.push(call);
      }
    }
    
    return { todayCalls, thisWeekCalls, earlierCalls };
  };
  
  const { todayCalls, thisWeekCalls, earlierCalls } = organizeCallsByPeriod();
  
  // Calculate stats
  const totalCalls = callHistory.length;
  
  // Calculate total duration in minutes
  const totalDurationMinutes = callHistory.reduce((total: number, call: CallHistoryItem) => {
    if (call.startTime && call.endTime) {
      const start = new Date(call.startTime);
      const end = new Date(call.endTime);
      const durationMs = end.getTime() - start.getTime();
      return total + (durationMs / 60000);
    }
    return total;
  }, 0);
  
  // Format transcript time
  const formatTranscriptTime = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return format(date, 'h:mm:ss a');
  };

  // Render call list table
  const renderCallTable = (calls: CallHistoryItem[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phone Number</TableHead>
          <TableHead>Date & Time</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-white text-opacity-60">
              No calls during this period
            </TableCell>
          </TableRow>
        ) : (
          calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-medium">{formatPhoneNumber(call.phoneNumber)}</TableCell>
              <TableCell>
                {format(new Date(call.startTime), 'MMM d, yyyy h:mm a')}
              </TableCell>
              <TableCell>{call.endTime ? formatDuration(call.startTime, call.endTime) : "N/A"}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  call.status === 'completed' ? 'bg-green-500 bg-opacity-20 text-green-400' : 
                  call.status === 'failed' ? 'bg-red-500 bg-opacity-20 text-red-400' :
                  'bg-blue-500 bg-opacity-20 text-blue-400'
                }`}>
                  {call.status}
                </span>
              </TableCell>
              <TableCell className="text-right flex justify-end space-x-1">
                {call.transcript && call.transcript.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2 text-xs text-purple-400 border-purple-400 hover:bg-purple-400 hover:bg-opacity-20"
                    onClick={() => {
                      setSelectedCall(call);
                      setIsTranscriptOpen(true);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Transcript
                  </Button>
                )}
                {call.summary && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-2 text-xs text-purple-400 border-purple-400 hover:bg-purple-400 hover:bg-opacity-20"
                    onClick={() => {
                      setSelectedCall(call);
                      setIsSummaryOpen(true);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Summary
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 w-8 text-xs text-red-400 border-red-400 hover:bg-red-400 hover:bg-opacity-20"
                  onClick={() => {
                    setSelectedCall(call);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
  
  return (
    <DashboardLayout>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this call record? This action cannot be undone.
              {selectedCall && (
                <div className="mt-2 text-sm bg-white bg-opacity-5 p-2 rounded border border-white border-opacity-10">
                  <p>Call to: {formatPhoneNumber(selectedCall.phoneNumber)}</p>
                  <p>Date: {format(new Date(selectedCall.startTime), 'MMM d, yyyy h:mm a')}</p>
                  {selectedCall.endTime && (
                    <p>Duration: {formatDuration(selectedCall.startTime, selectedCall.endTime)}</p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteCall();
              }}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Transcript Dialog */}
      <Dialog open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-purple-400" />
                Call Transcript
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsTranscriptOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <div className="text-sm text-gray-400 mb-2">
                  Call to {formatPhoneNumber(selectedCall.phoneNumber)} at {format(new Date(selectedCall.startTime), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 p-2">
            {selectedCall?.transcript && selectedCall.transcript.length > 0 ? (
              selectedCall.transcript.map((message, index) => (
                <div 
                  key={index} 
                  className={`${message.isUser 
                    ? 'ml-auto bg-purple-500 bg-opacity-20 text-white border-purple-400' 
                    : 'mr-auto bg-white bg-opacity-10 border-white border-opacity-20'} 
                    max-w-[80%] rounded-lg p-3 border`}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {message.isUser ? 'You' : 'Caller'} • {formatTranscriptTime(message.timestamp)}
                  </div>
                  <div className="text-sm">{message.text}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                No transcript available for this call.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Summary Dialog */}
      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-purple-400" />
                Call Summary
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsSummaryOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <div className="text-sm text-gray-400 mb-2">
                  Call to {formatPhoneNumber(selectedCall.phoneNumber)} • {selectedCall.endTime && selectedCall.startTime 
                    ? formatDuration(selectedCall.startTime, selectedCall.endTime) 
                    : "N/A"}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-white bg-opacity-5 rounded-lg p-4 border border-white border-opacity-10">
            {selectedCall?.summary ? (
              <p className="text-sm whitespace-pre-line">{selectedCall.summary}</p>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No summary available for this call.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <motion.div 
        initial="hidden"
        animate="show"
        variants={fadeIn}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-white text-opacity-80 mt-1">
            Track your recent calls and communication activities
          </p>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
            <CardHeader className="pb-2">
              <div className="flex items-center mb-2">
                <Phone className="h-5 w-5 mr-2 text-purple-400" />
                <CardTitle>Total Calls</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCalls}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
            <CardHeader className="pb-2">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 mr-2 text-purple-400" />
                <CardTitle>Talk Time</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalDurationMinutes.toFixed(1)}<span className="text-xl ml-1">min</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
            <CardHeader className="pb-2">
              <div className="flex items-center mb-2">
                <Calendar className="h-5 w-5 mr-2 text-purple-400" />
                <CardTitle>Latest Call</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {callHistory.length > 0 ? (
                  <>{formatDistance(new Date(callHistory[0].startTime), new Date(), { addSuffix: true })}</>
                ) : (
                  'No calls yet'
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Call List */}
        <Card className="bg-white bg-opacity-10 border-white border-opacity-20">
          <CardHeader>
            <CardTitle>Calls List</CardTitle>
            <CardDescription className="text-white text-opacity-60">
              View details of all your past calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-2 text-white text-opacity-60">Loading call history...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">
                Failed to load call history. Please try again.
              </div>
            ) : (
              <Tabs defaultValue="today">
                <TabsList className="mb-4">
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="week">This Week</TabsTrigger>
                  <TabsTrigger value="earlier">Earlier</TabsTrigger>
                  <TabsTrigger value="all">All Calls</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-0">
                  {renderCallTable(todayCalls)}
                </TabsContent>
                <TabsContent value="week" className="mt-0">
                  {renderCallTable(thisWeekCalls)}
                </TabsContent>
                <TabsContent value="earlier" className="mt-0">
                  {renderCallTable(earlierCalls)}
                </TabsContent>
                <TabsContent value="all" className="mt-0">
                  {renderCallTable(callHistory)}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}