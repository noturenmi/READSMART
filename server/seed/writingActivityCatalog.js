const { rubricCriteria } = require('../utils/writingRubric');

const instructions = 'Write 100–250 words. Answer every part of the prompt, organize your ideas into clear paragraphs, and support your main point with explanations or examples from the lesson. Use your own words.';

const activityDefinitions = [
  ['MIL', 1, 'Check Before You Share', 'Describe a piece of information you have encountered in school or daily life. Explain how you would check its source, accuracy, and purpose before deciding whether to believe or share it.'],
  ['MIL', 2, 'One Topic, Different Media', 'Choose one school or community topic and explain how it could be presented through print, broadcast, digital, and social media. Compare how the medium may affect the way people receive the information.'],
  ['MIL', 3, 'A Credible Source Review', 'Choose a source you might use for a school task. Discuss its author, date, evidence, purpose, and publisher, then explain whether it is suitable for your topic.'],
  ['MIL', 4, 'Evaluate Before Accepting', 'Explain how you would evaluate a source for currency, relevance, authority, accuracy, and purpose. Use a source related to a school topic to illustrate your process.'],
  ['MIL', 5, 'Think, Check, Verify', 'Explain how you would respond to a surprising claim shared online. Distinguish what would help you identify misinformation from signs of deliberate disinformation, and describe what you would verify before sharing.'],
  ['MIL', 6, 'My Digital Citizenship Plan', 'Create a short plan for responsible social media use. Explain how you would protect privacy, respect consent, communicate respectfully, and think about your digital footprint before posting.'],
  ['MIL', 7, 'Compare Media Perspectives', 'Choose a topic covered by two credible media sources. Explain how headlines, word choice, images, included details, or omitted details may shape each presentation, and how you would compare the evidence fairly.'],
  ['MIL', 8, 'Use Information Responsibly', 'Describe how you would use another person’s information or ideas in a school task while respecting attribution, privacy, and the creator’s rights. Explain why each responsibility matters.'],
  ['MIL', 9, 'Credit Creators and Sources', 'Explain the difference between copyright and plagiarism. Describe how you would properly quote or paraphrase a source and give credit in a school project.'],
  ['MIL', 10, 'Persuasion in an Advertisement', 'Analyze an advertisement you have seen. Identify persuasive techniques it uses, distinguish its factual claims from persuasive language, and explain what evidence or conditions you would check before acting on it.'],

  ['UCSP', 1, 'Culture in Everyday Life', 'Describe examples of culture in everyday life, such as language, food, traditions, or values. Explain how people learn these practices and how they can change over time.'],
  ['UCSP', 2, 'Elements of Culture at Work', 'Choose a familiar community practice and explain how at least three cultural elements—such as symbols, language, values, norms, beliefs, or material culture—work together within it.'],
  ['UCSP', 3, 'Respecting Cultural Differences', 'Explain how history, environment, or social experience can contribute to cultural differences. Describe how open-mindedness can help people avoid stereotypes and interact respectfully.'],
  ['UCSP', 4, 'Belonging to Social Groups', 'Describe two social groups a person may belong to and explain how relationships, shared interests, or interaction connect members. Discuss how belonging to several groups can shape daily experiences.'],
  ['UCSP', 5, 'How People Learn Social Expectations', 'Explain how socialization and enculturation help people learn ways of behaving and cultural practices. Use examples from settings such as family, school, community, or media.'],
  ['UCSP', 6, 'Understanding Social Stratification', 'Explain how social stratification can create differences in access to resources or opportunities. Describe why understanding inequality requires considering social conditions rather than making assumptions about individuals.'],
  ['UCSP', 7, 'Social Institutions in Daily Life', 'Choose a social institution discussed in the lesson and explain its role in society. Describe how it can influence people’s needs, relationships, or everyday experiences.'],
  ['UCSP', 8, 'Understanding Politics and Power', 'In your own words, explain what politics and power mean in social life. Describe how decisions and relationships can affect a community, using a neutral example from everyday life.'],
  ['UCSP', 9, 'Participation and Citizenship', 'Explain how citizens can participate in community or public life. Describe one responsible way a student can learn about an issue, express a view, or contribute to a group decision.'],
  ['UCSP', 10, 'Culture, Society, and Politics in Context', 'Explain how culture, society, and politics can influence one another in the Philippine context. Use a lesson example and describe why local experiences should be considered when discussing social issues.'],

  ['CPAR', 1, 'Art in Contemporary Life', 'Explain what makes an artwork contemporary and describe how art can reflect present-day experiences. Use an artwork, art form, or example discussed in the lesson.'],
  ['CPAR', 2, 'Characteristics of Contemporary Art', 'Choose an artwork or art form discussed in the lesson. Explain which characteristics make it contemporary and how its form or presentation communicates an idea to an audience.'],
  ['CPAR', 3, 'Interpreting an Artist’s Work', 'Choose a Filipino artist or work included in the lesson. Describe what the work communicates and explain how its form, materials, or context can shape an audience’s interpretation.'],
  ['CPAR', 4, 'Looking Closely at Visual Art', 'Select a visual artwork discussed in the lesson. Describe details a viewer can observe and explain how its visual elements and context contribute to its meaning.'],
  ['CPAR', 5, 'Experiencing Performing Arts', 'Choose a performing art form discussed in the lesson. Explain how performers, movement or sound, and the performance setting work together to communicate an idea or experience.'],
  ['CPAR', 6, 'Meaning in Literary and Written Arts', 'Explain how a written or literary work can communicate experiences, ideas, or cultural perspectives. Use an example from the lesson and describe how a reader might interpret it.'],
  ['CPAR', 7, 'Music, Tradition, and Change', 'Explain how contemporary Philippine music can draw on cultural traditions while using new styles or technology. Support your explanation with a lesson example.'],
  ['CPAR', 8, 'Dance as Cultural Expression', 'Describe how dance can communicate an idea, story, emotion, or cultural identity. Explain how movement and at least one other performance element can contribute to its meaning.'],
  ['CPAR', 9, 'An Idea for Digital or Multimedia Art', 'Propose a digital or multimedia artwork about an experience or idea familiar to your community. Explain the message you want to communicate and how at least two media forms or digital tools could support it.'],
  ['CPAR', 10, 'Art in a Local or Regional Context', 'Explain how local history, environment, language, traditions, or community experiences can influence contemporary art. Use a regional or local example from the lesson and describe its context respectfully.'],

  ['ELS', 1, 'Earth Systems and Life', 'Explain how Earth Science and Life Science help us understand the relationship between Earth and living organisms. Describe one way a change in one Earth system can affect life.'],
  ['ELS', 2, 'Earth’s Structure and Systems', 'Describe Earth’s major internal layers and explain how they differ. Then connect Earth’s structure to at least one of its interacting systems discussed in the lesson.'],
  ['ELS', 3, 'When Tectonic Plates Move', 'Explain how tectonic plates move and compare two types of plate boundaries. Describe a geological process that can result from plate movement, using the lesson as your source.'],
  ['ELS', 4, 'From Minerals to Rocks', 'Explain the difference between minerals and rocks. Compare how igneous, sedimentary, and metamorphic rocks form and connect your explanation to the rock cycle.'],
  ['ELS', 5, 'A Rock’s Changing Journey', 'Trace how a rock can change through weathering, erosion, deposition, heat, pressure, melting, or cooling. Explain how these processes connect to the rock cycle.'],
  ['ELS', 6, 'Connected Earth Systems', 'Explain how the atmosphere, hydrosphere, geosphere, and biosphere interact. Use one process from the lesson to show how a change in one system can affect another.'],
  ['ELS', 7, 'What Makes Something Living?', 'Explain several characteristics used to describe living things. Describe how these characteristics help distinguish organisms from nonliving matter, using examples from the lesson.'],
  ['ELS', 8, 'Cell Parts Working Together', 'Choose at least three cell structures from the lesson and explain their functions. Describe how these structures work together to support activities needed by a cell.'],
  ['ELS', 9, 'Understanding Biodiversity', 'Explain biodiversity at the genetic, species, and ecosystem levels. Describe how classification helps organize knowledge about organisms and why conservation can matter.'],
  ['ELS', 10, 'Sustainability in an Ecosystem', 'Explain how biotic and abiotic factors interact in an ecosystem. Describe one way human activity can affect those interactions and how sustainable resource use can help protect ecosystem functions.'],
];

const writingActivityCatalog = activityDefinitions.map(([subjectCode, lessonNumber, title, prompt]) => ({
  subjectCode,
  lessonNumber,
  title,
  prompt,
  instructions,
  minimumWords: 100,
  maximumWords: 250,
  criteria: rubricCriteria.map((criterion) => ({ ...criterion })),
  isPublished: true,
}));

module.exports = { writingActivityCatalog };
