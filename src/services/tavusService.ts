interface TavusPersona {
  persona_id: string;
  persona_name: string;
  status: string;
}

interface TavusConversation {
  conversation_id: string;
  status: string;
  callback_url?: string;
  conversation_url?: string;
}

interface TavusConversationConfig {
  persona_id: string;
  callback_url?: string;
  properties?: {
    max_call_duration?: number;
    participant_left_timeout?: number;
    enable_recording?: boolean;
    language?: string;
  };
}

class TavusService {
  private apiKey: string;
  private baseUrl = 'https://tavusapi.com';
  private drAvaPersonaId = 'p9863a04af01'; // Updated Dr. Ava persona ID

  constructor() {
    this.apiKey = import.meta.env.VITE_TAVUS_API_KEY;
    if (!this.apiKey) {
      console.warn('Tavus API key not found in environment variables');
    }
  }

  private getMedicalSystemPrompt(): string {
    return `You are Dr. Ava, a professional and empathetic AI medical assistant. Your role is to provide helpful medical guidance while maintaining the highest standards of care.

CORE IDENTITY:
- You are a warm, professional, and knowledgeable medical AI
- You have extensive medical knowledge but always emphasize the importance of professional medical care
- You speak in a calm, reassuring tone while being thorough and accurate

MEDICAL GUIDELINES:
- Provide helpful medical information and guidance
- Always recommend consulting healthcare professionals for serious concerns
- If symptoms seem severe or emergency-related, immediately suggest emergency care
- Use simple, understandable language that patients can easily follow
- Show genuine concern for the patient's wellbeing
- Ask relevant follow-up questions to better understand symptoms

CONVERSATION STYLE:
- Be conversational and natural in video calls
- Maintain eye contact and use appropriate facial expressions
- Speak at a comfortable pace, allowing for patient responses
- Show empathy and understanding for patient concerns
- Use encouraging and supportive language

SAFETY PROTOCOLS:
- Never provide specific diagnoses - only general medical information
- Always emphasize the need for professional medical evaluation
- For emergencies, immediately direct to emergency services
- Maintain patient confidentiality and privacy
- Be honest about limitations as an AI assistant

SPECIALIZATION AREAS:
- General health and wellness guidance
- Symptom assessment and triage
- Medication information and interactions
- Preventive care recommendations
- Mental health support and resources
- Chronic condition management guidance

Remember: You are here to support and guide patients, but professional medical care is irreplaceable for proper diagnosis and treatment.`;
  }

  async createConversation(): Promise<TavusConversation> {
    try {
      if (!this.apiKey || this.apiKey === 'your_tavus_api_key_here') {
        console.warn('Tavus API key not configured, using mock conversation');
        // Return mock data for development
        return {
          conversation_id: `mock_${Date.now()}`,
          status: 'active',
          conversation_url: `${window.location.origin}/mock-tavus-conversation`
        };
      }

      // Use the specific persona ID provided
      const personaId = this.drAvaPersonaId; // p9863a04af01
      console.log('Creating Tavus conversation with persona ID:', personaId);

      const conversationConfig: TavusConversationConfig = {
        persona_id: personaId,
        properties: {
          max_call_duration: 1800, // 30 minutes
          participant_left_timeout: 60,
          enable_recording: false,
          language: 'English'
        }
      };

      console.log('Tavus conversation config:', conversationConfig);

      const response = await fetch(`${this.baseUrl}/v2/conversations`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationConfig),
      });

      const responseText = await response.text();
      console.log('Tavus API Response Status:', response.status);
      console.log('Tavus API Response Body:', responseText);

      if (!response.ok) {
        console.error('Tavus API Error Response:', responseText);
        
        // Try to parse error details
        let errorMessage = `Tavus API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (e) {
          // Use default error message if JSON parsing fails
        }
        
        // Handle specific error cases
        if (response.status === 401) {
          errorMessage = 'Invalid Tavus API key. Please check your VITE_TAVUS_API_KEY environment variable.';
        } else if (response.status === 403) {
          errorMessage = 'Tavus API access forbidden. Please check your API key permissions.';
        } else if (response.status === 404) {
          errorMessage = `Persona ID ${personaId} not found. Please verify the persona exists in your Tavus account.`;
        } else if (response.status === 422) {
          errorMessage = 'Invalid conversation configuration. Please check the persona ID and settings.';
        }
        
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid JSON response from Tavus API');
      }

      console.log('Tavus conversation created successfully with persona p9863a04af01:', result);
      
      return result;
    } catch (error) {
      console.error('Error creating Tavus conversation:', error);
      
      // Return mock data as fallback with more realistic URL
      return {
        conversation_id: `fallback_${Date.now()}`,
        status: 'active',
        conversation_url: `${window.location.origin}/mock-tavus-conversation`
      };
    }
  }

  async updateConversationContext(conversationId: string, context: string): Promise<boolean> {
    try {
      // Skip API call if no API key or using mock/fallback conversation
      if (!this.apiKey || 
          this.apiKey === 'your_tavus_api_key_here' || 
          conversationId.startsWith('mock_') || 
          conversationId.startsWith('fallback_')) {
        console.log('Skipping conversation context update - using mock/fallback mode');
        return true;
      }

      const contextData = {
        context: context,
        system_prompt: this.getMedicalSystemPrompt()
      };

      console.log('Updating conversation context for:', conversationId);

      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.baseUrl}/v2/conversations/${conversationId}/context`, {
        method: 'PUT',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contextData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update conversation context:', response.status, errorText);
        
        // Log specific error details for debugging
        if (response.status === 0) {
          console.error('Network error: Unable to reach Tavus API. Check internet connection and CORS settings.');
        } else if (response.status === 401) {
          console.error('Authentication error: Invalid API key or insufficient permissions.');
        } else if (response.status === 403) {
          console.error('Authorization error: API key does not have permission to update conversation context.');
        } else if (response.status === 404) {
          console.error('Conversation not found: The conversation ID may be invalid or expired.');
        }
        
        return false;
      }

      console.log('Conversation context updated successfully');
      return true;
    } catch (error) {
      // Consolidated error logging - single comprehensive message
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('Tavus API Network Error: Unable to reach Tavus API. This could be due to internet connectivity issues, CORS restrictions (Tavus API may not allow requests from localhost), firewall or network security blocking the request, or Tavus API service being temporarily unavailable.');
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.error('Tavus API Timeout: Request did not complete within 10 seconds');
      } else {
        console.error('Tavus API Error:', error instanceof Error ? error.message : error);
      }
      
      // Return false instead of throwing to make this non-blocking
      return false;
    }
  }

  async sendMessage(conversationId: string, message: string): Promise<void> {
    try {
      if (!this.apiKey || 
          this.apiKey === 'your_tavus_api_key_here' || 
          conversationId.startsWith('mock_') || 
          conversationId.startsWith('fallback_')) {
        console.log('Skipping message send - using mock/fallback mode');
        return;
      }

      const response = await fetch(`${this.baseUrl}/v2/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sender: 'system'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send message:', errorText);
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending message to conversation:', error);
      // Don't throw the error to prevent breaking the consultation flow
    }
  }

  async getPersonas(): Promise<TavusPersona[]> {
    try {
      if (!this.apiKey || this.apiKey === 'your_tavus_api_key_here') {
        console.log('No Tavus API key, returning empty personas list');
        return [];
      }

      console.log('Fetching Tavus personas...');

      const response = await fetch(`${this.baseUrl}/v2/personas`, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tavus personas API error:', errorText);
        throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Tavus personas response:', data);
      
      // Check if our specific persona exists
      const personas = data.data || data.personas || [];
      const targetPersona = personas.find((p: TavusPersona) => p.persona_id === this.drAvaPersonaId);
      
      if (targetPersona) {
        console.log('Found target persona p9863a04af01:', targetPersona);
      } else {
        console.warn('Target persona p9863a04af01 not found in available personas');
        console.log('Available personas:', personas.map((p: TavusPersona) => ({ id: p.persona_id, name: p.persona_name })));
      }
      
      return personas;
    } catch (error) {
      console.error('Error fetching Tavus personas:', error);
      return [];
    }
  }

  async endConversation(conversationId: string): Promise<void> {
    try {
      if (!this.apiKey || 
          this.apiKey === 'your_tavus_api_key_here' || 
          conversationId.startsWith('mock_') || 
          conversationId.startsWith('fallback_')) {
        // Skip API call for mock conversations
        console.log('Skipping conversation end - using mock/fallback mode');
        return;
      }

      const response = await fetch(`${this.baseUrl}/v2/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to end conversation:', errorText);
        throw new Error(`Failed to end conversation: ${response.status} ${response.statusText}`);
      }

      console.log('Conversation ended successfully');
    } catch (error) {
      console.error('Error ending Tavus conversation:', error);
      // Don't throw the error to prevent breaking the consultation flow
    }
  }

  async getConversationStatus(conversationId: string): Promise<string> {
    try {
      if (!this.apiKey || 
          this.apiKey === 'your_tavus_api_key_here' || 
          conversationId.startsWith('mock_') || 
          conversationId.startsWith('fallback_')) {
        return 'active';
      }

      const response = await fetch(`${this.baseUrl}/v2/conversations/${conversationId}`, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error getting conversation status:', errorText);
        throw new Error(`Tavus API error: ${response.status}`);
      }

      const data = await response.json();
      return data.status || 'unknown';
    } catch (error) {
      console.error('Error getting conversation status:', error);
      return 'error';
    }
  }

  // Helper method to check if API is properly configured
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiKey !== 'your_tavus_api_key_here');
  }

  // Helper method to get configuration status
  getConfigurationStatus(): string {
    if (!this.apiKey) {
      return 'No API key found in environment variables';
    }
    if (this.apiKey === 'your_tavus_api_key_here') {
      return 'Placeholder API key detected - please update with real key';
    }
    return `API key configured - using persona ${this.drAvaPersonaId}`;
  }

  // Helper method to get the persona ID being used
  getPersonaId(): string {
    return this.drAvaPersonaId;
  }
}

export const tavusService = new TavusService();