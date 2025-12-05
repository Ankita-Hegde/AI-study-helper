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

export interface StudyData {
    notes: string;
    flashcards: Flashcard[];
    quiz: QuizQuestion[];
}

export interface StudyGuide {
    guide: string;
}
