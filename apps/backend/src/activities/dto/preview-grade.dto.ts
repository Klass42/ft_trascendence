import { SaveAnswersDto } from '../attempts/dto/save-answers.dto';

/** Stateless grading request; the response shape matches answer autosaves. */
export class PreviewGradeDto extends SaveAnswersDto {}
