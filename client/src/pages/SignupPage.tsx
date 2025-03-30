import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { fadeIn, cardAnimation } from "@/lib/animations";
import { signupSchema } from "@/lib/validation";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: (data: Omit<SignupFormValues, "confirmPassword" | "terms">) => 
      apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: (data) => {
      toast({
        title: "Account created",
        description: "Your account has been created successfully! You can now log in.",
        variant: "default",
      });
      // Redirect to the login page
      setLocation("/login");
    },
    onError: (error: any) => {
      console.error("Signup error:", error);
      toast({
        title: "Signup failed",
        description: error.message || "An error occurred while creating your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false
    }
  });

  function onSubmit(data: SignupFormValues) {
    console.log("Signup attempt with:", data);
    const { confirmPassword, terms, ...userData } = data;
    signupMutation.mutate(userData);
  }

  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
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
                  onClick={() => setLocation("/login")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Create your account</h2>
                  <p className="text-gray-600 mt-2">Sign up to start using Unmute</p>
                </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">First Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="First name" 
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
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Last Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Last name" 
                                {...field} 
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-purple-700 transition-all duration-200"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                          <FormLabel className="text-gray-700">Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Create a password (min. 8 characters)" 
                              {...field}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-purple-700 transition-all duration-200" 
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-gray-500">
                            Must be at least 8 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Confirm Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Confirm your password" 
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
                      name="terms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-1 data-[state=checked]:bg-purple-700 data-[state=checked]:text-white"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-gray-700">
                              I agree to the <Link href="#"><span className="text-purple-700 hover:text-purple-500 cursor-pointer">Terms of Service</span></Link> and <Link href="#"><span className="text-purple-700 hover:text-purple-500 cursor-pointer">Privacy Policy</span></Link>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-purple-800 to-purple-500 hover:from-purple-700 hover:to-purple-400 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Create Account
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Already have an account?{" "}
                    <Link href="/login">
                      <span className="text-purple-700 font-medium hover:text-purple-500 cursor-pointer">Log in</span>
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
