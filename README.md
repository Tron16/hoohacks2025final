# Unmute 🎤

**Winner: Best Accessibility & Empowerment - HooHacks 2025**

_We believe everyone deserves to be heard — on their own terms._

Unmute is an innovative calling application designed specifically for people with speech differences, hearing difficulties, or conditions like selective mutism. This accessibility-focused solution enables users to make phone calls using AI-generated speech from text input, breaking down communication barriers and making phone calls more accessible for everyone.

Built with React, TypeScript, Express, and integrates OpenAI's Text-to-Speech API with Twilio's Voice API for seamless voice calling.

## 🌟 Features

### Accessibility & Empowerment

- **Barrier-Free Communication**: Enables individuals with speech differences to make phone calls confidently
- **Real-time Transcription**: Live transcription of receiver responses displayed in chat window
- **Post-Call Summaries**: Comprehensive call summaries for reference and accessibility
- **Call History**: Complete log of all calls for easy tracking and review
- **Customizable Voice Settings**: Multiple voice options and speed controls for personalized experience

### Core Functionality

- **Text-to-Speech Conversion**: Convert typed messages into natural-sounding speech using OpenAI's TTS API
- **Voice Calling**: Make real phone calls using Twilio's toll-free number
- **Real-time Call Management**: Track call status with live updates (connecting, in-progress, ended)
- **Two-Way Communication**: Type messages that are converted to speech, receive transcribed responses
- **Voice Customization**: Choose from multiple AI voices and adjust speaking speed
- **Responsive UI**: Modern, accessible interface that works on desktop and mobile

### Technical Features

- **Real-time Updates**: WebSocket integration for live call status updates
- **Call Timer**: Track call duration in real-time
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Database Integration**: PostgreSQL with Drizzle ORM for data persistence
- **Type Safety**: Full TypeScript implementation across frontend and backend

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database
- Twilio account with Voice API access
- OpenAI API account

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration
DATABASE_URL=your_postgresql_connection_string

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd Hoohacks-2025
```

2. Install dependencies:

```bash
npm install
```

3. Set up the database:

```bash
npm run db:push
```

4. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🏗️ Architecture

### Frontend (`/client`)

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **React Query** for API state management
- **Wouter** for routing
- **WebSocket** client for real-time updates

### Backend (`/server`)

- **Express.js** with TypeScript
- **WebSocket Server** for real-time communication
- **Twilio SDK** for voice calling
- **OpenAI SDK** for text-to-speech
- **Drizzle ORM** with PostgreSQL

### Key Components

#### Frontend Components

- `HomePage`: Main application interface
- `MessageInput`: Text input for messages
- `PhoneInput`: Phone number input with validation
- `VoiceOptions`: Voice selection and speed controls
- `CallControls`: Call/hangup buttons with status
- `CallStatusCard`: Real-time call status display

#### Backend Services

- `twilio.ts`: Handles call initiation, termination, and webhooks
- `openai.ts`: Manages text-to-speech generation
- `routes.ts`: API endpoints and WebSocket server setup

## 📱 Usage

### Making a Call

1. **Enter Message**: Type the message you want to be spoken during the call
2. **Select Voice**: Choose from available AI voices (alloy, echo, fable, onyx, nova, shimmer)
3. **Adjust Speed**: Set speaking speed from 0.5x to 1.5x
4. **Enter Phone Number**: Input the recipient's phone number
5. **Make Call**: Click the call button to initiate the call using our toll-free number

### During the Call

6. **Monitor Status**: Watch real-time call status updates
7. **View Transcriptions**: See live transcriptions of the receiver's responses in the chat window
8. **Send Messages**: Type additional messages that will be converted to speech for the receiver
9. **End Call**: Use the hangup button to terminate the call

### After the Call

10. **Review Summary**: Access post-call summary for reference
11. **Check History**: View your complete call history log

## 🔧 API Endpoints

### Call Management

- `POST /api/call/initiate` - Start a new call
- `POST /api/call/terminate` - End an active call
- `GET /api/call/status/:callSid` - Get call status

### Text-to-Speech

- `POST /api/tts/generate` - Generate speech audio from text

### Webhooks

- `POST /api/twilio/webhooks` - Handle Twilio call events

### WebSocket

- `ws://localhost:3000/ws/transcriptions` - Real-time call updates

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run check        # TypeScript type checking

# Production
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Push schema changes to database
```

### Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   └── pages/         # Page components
├── server/                # Backend Express application
│   ├── services/          # Business logic services
│   ├── index.ts          # Server entry point
│   └── routes.ts         # API routes
├── shared/               # Shared types and schemas
└── README.md
```

## 🔒 Security Considerations

- API keys are stored in environment variables
- Phone number validation and formatting
- Rate limiting on API endpoints (recommended for production)
- Webhook signature verification (recommended for production)
- CORS configuration for production deployment

## 🚀 Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Setup

- Set `NODE_ENV=production`
- Configure production database URL
- Set up proper CORS origins
- Configure webhook URLs for your domain

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 Awards & Recognition

**Winner: Best Accessibility & Empowerment - HooHacks 2025**

This project was recognized for its innovative approach to making communication more accessible for individuals with speech differences and hearing difficulties.

## 💡 Inspiration

According to the U.S. Department of Health and Human Services:

- **1 in 8 people** in the United States (13%, or 30 million) ages 12 or older have hearing loss in both ears
- **More than 90%** of children with Selective Mutism also have social phobia or social anxiety

Our primary goal is to assist people within this range and make phone calls more accessible for everyone who faces communication barriers.

## 🚧 Challenges We Overcame

The biggest challenge was integrating OpenAI and Twilio APIs to create seamless real-time communication. After extensive debugging and testing, we successfully achieved:

- Live audio transcription during calls
- Real-time text-to-speech conversion
- Stable API integration between multiple services
- Smooth user experience across all features

## 🔮 Future Enhancements

- **Stripe ID Verification**: Prevent API abuse with user verification
- **User Feedback Loop**: Collect feedback to better understand user needs
- **Usage Analytics**: Analyze call data patterns and performance insights
- **Performance Monitoring**: Identify bottlenecks and optimize user experience
- **Enhanced Accessibility**: Additional features based on user feedback

## 👥 Team

Created by:

- **Saravana Balaji**
- **Kevin Benoy**
- **Ashish Nattami**
- **Colin YangYang Zhang**

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for Text-to-Speech API
- [Twilio](https://twilio.com/) for Voice API
- [Shadcn/ui](https://ui.shadcn.com/) for UI components
- [Drizzle ORM](https://orm.drizzle.team/) for database management
- [HooHacks 2025](https://devpost.com/software/unmute-lc5nkw) for recognizing our accessibility efforts

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

## 🌐 Live Demo

- **Devpost Project**: [Unmute on Devpost](https://devpost.com/software/unmute-lc5nkw)
- **GitHub Repository**: Available in this repository
- **Live Application**: unmute-final-saravanabalaji1.replit.app _(Note: Demo may not be functional due to API keys not being included for security)_

---

**Important**: This application is designed specifically for individuals with speech differences, hearing difficulties, or conditions like selective mutism. It aims to make phone communication more accessible and empowering. Please ensure compliance with local regulations regarding automated calling and AI-generated content disclosure when using this application.

**Built with**: CSS3, HTML5, JSON, Neon, OpenAI, React, Shadcn/ui, Tailwind CSS, Twilio, TypeScript, WebSockets
