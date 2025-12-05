export interface Flashcard {
    front: string;
    back: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface Chapter {
    title: string;
    timestamp?: string;  // For videos (e.g., "00:00", "05:23")
    description: string;
    section?: number;    // For documents (page/section number)
}

export interface StudyData {
    notes: string;
    flashcards: Flashcard[];
    quiz: QuizQuestion[];
    chapters: Chapter[];
}

export interface StudyGuide {
    guide: string;
}
