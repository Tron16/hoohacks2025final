import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { fadeIn, cardAnimation } from "@/lib/animations";
import { loginSchema } from "@/lib/validation";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: (data: LoginFormValues) => 
      apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: (data) => {
      toast({
        title: "Login successful",
        description: "Welcome back!",
        variant: "default",
      });
      // Redirect to the dashboard
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  });

  function onSubmit(data: LoginFormValues) {
    console.log("Login attempt with:", data);
    loginMutation.mutate(data);
  }

  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center px-4">
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
            <Card className="bg-white rounded-xl shadow-xl p-8 w-full">
              <CardContent className="p-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-4 left-4 text-gray-600 hover:text-gray-800" 
                  onClick={() => setLocation("/")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
                  <p className="text-gray-600 mt-2">Log in to your Unmute account</p>
                </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="your@email.com" 
                              {...field} 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-purple-700 transition-all duration-200"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel className="text-gray-700">Password</FormLabel>
                            <Link href="#">
                              <span className="text-sm text-purple-700 hover:text-purple-500 cursor-pointer">Forgot password?</span>
                            </Link>
                          </div>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-purple-700 transition-all duration-200" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-purple-700 data-[state=checked]:text-white"
                            />
                          </FormControl>
                          <FormLabel className="text-sm text-gray-700 cursor-pointer">
                            Remember me
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-purple-800 to-purple-500 hover:from-purple-700 hover:to-purple-400 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Log In
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Don't have an account?{" "}
                    <Link href="/signup">
                      <span className="text-purple-700 font-medium hover:text-purple-500 cursor-pointer">Sign up</span>
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </GradientBackground>
  );
}
