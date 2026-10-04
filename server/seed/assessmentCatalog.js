const questionTypes = ['key_idea', 'vocabulary', 'inference', 'interpretation', 'evaluation'];
const explanationByType = {
  key_idea: 'This captures a central idea from the lesson',
  vocabulary: 'This is the meaning used in the lesson',
  inference: 'This conclusion follows from the lesson',
  interpretation: 'This is what the lesson example demonstrates',
  evaluation: 'This choice applies the lesson guidance',
};

function q(question, answer, distractors, correctIndex) {
  return { question, answer, distractors, correctIndex };
}

function lesson(keyIdea, vocabulary, inference, interpretation, evaluation) {
  return [keyIdea, vocabulary, inference, interpretation, evaluation];
}

const lessonsBySubject = {
  MIL: [
    lesson(
      q('What does media and information literacy help a person do with media messages?', 'Access, analyze, evaluate, create, and communicate information using media.', ['Accept every message without checking it.', 'Use only printed sources for schoolwork.', 'Avoid creating or sharing any information.'], 1),
      q('In the lesson, what does information include?', 'Facts, ideas, data, opinions, and knowledge.', ['Only verified statistics from government reports.', 'Only messages published by news organizations.', 'Only personal opinions shared online.'], 0),
      q('A student compares a news report with a social post before sharing a claim. Which skill is the student applying?', 'Evaluating media information before communicating it.', ['Assuming that the most popular post is accurate.', 'Using media only for entertainment.', 'Avoiding all sources that disagree.'], 2),
      q('Why does the lesson treat media and information literacy as more than operating a device?', 'It includes interpreting and evaluating messages, as well as creating and communicating them.', ['It focuses only on repairing electronic devices.', 'It requires using one specific social media platform.', 'It means memorizing every message a person encounters.'], 3),
      q('Which response best applies media and information literacy when two sources make different claims?', 'Compare their evidence and context before deciding what to share.', ['Share the claim with the more dramatic headline.', 'Choose whichever claim confirms an existing opinion.', 'Assume both claims are equally accurate.'], 0),
    ),
    lesson(
      q('Which description best distinguishes the media types discussed in the lesson?', 'Print uses printed materials, broadcast uses radio or television, and digital uses electronic platforms.', ['Print is always false, broadcast is always neutral, and digital is always reliable.', 'Print is spoken, broadcast is handwritten, and digital is limited to games.', 'All media types use the same format and reach audiences in the same way.'], 2),
      q('Which example is broadcast media?', 'A radio program.', ['A printed brochure.', 'A bound textbook.', 'A handwritten letter.'], 1),
      q('A class uses an online video and a printed newspaper article to study one event. What can be inferred?', 'Different media formats can present information about the same topic.', ['Only the newspaper can contain information.', 'The video must be more accurate because it is digital.', 'The two materials cannot be compared.'], 3),
      q('What does the lesson’s grouping of print, broadcast, and digital media show?', 'Media can be classified by the formats and channels used to communicate messages.', ['Every message belongs to only one subject area.', 'Media types are classified by whether audiences agree with them.', 'A message changes its facts when its format changes.'], 0),
      q('A student needs to share a short audio announcement with listeners who are not online. Which choice best matches the lesson?', 'Use a broadcast channel such as radio.', ['Publish only a printed photograph.', 'Post it on a digital-only platform.', 'Replace the announcement with a textbook chapter.'], 2),
    ),
    lesson(
      q('Which set of checks most directly helps assess an information source’s credibility?', 'Consider the author, publication date, and supporting evidence.', ['Count the colors, images, and page length.', 'Check whether the title is entertaining and familiar.', 'Use the number of comments as the only measure.'], 3),
      q('In source evaluation, what does checking the author help a reader determine?', 'Who created the information and whether they have relevant knowledge.', ['How many people have already shared the information.', 'Whether the article uses a printed or digital layout.', 'How recently the reader first saw the claim.'], 0),
      q('A claim has no cited research, data, or references. What is a reasonable inference?', 'The reader has less evidence for judging the claim’s credibility.', ['The claim is automatically true because it is short.', 'The missing references prove the author is an expert.', 'The claim cannot be checked in any way.'], 1),
      q('Why does the lesson ask readers to check both the date and evidence?', 'Timeliness and support are separate clues that help readers judge a source.', ['A recent date guarantees that every claim is correct.', 'Evidence matters only when an article is old.', 'The date identifies the author’s qualifications.'], 2),
      q('Two pages make the same claim, but only one identifies its author and provides supporting sources. What should a student do?', 'Examine the author and evidence before relying on either claim.', ['Trust the page with the larger number of images.', 'Assume repetition proves the claim.', 'Choose the page that appeared first in search results.'], 1),
    ),
    lesson(
      q('What is the main purpose of evaluating information?', 'To judge whether information is useful and credible for a particular purpose.', ['To find the longest page about a topic.', 'To confirm that every source supports one’s first opinion.', 'To replace research with a quick guess.'], 0),
      q('What does relevance mean when evaluating a source?', 'How directly the information relates to the topic or purpose.', ['How many years the author has used the internet.', 'Whether the source is formatted as a video.', 'How strongly the source agrees with the reader.'], 2),
      q('A student finds an accurate article that does not answer the research question. What can be inferred?', 'The article may be credible but not relevant to that task.', ['The article must be disinformation.', 'An irrelevant article becomes useful if it is popular.', 'Accuracy and relevance mean exactly the same thing.'], 3),
      q('Why should currency, relevance, and authority be checked separately?', 'Each criterion addresses a different aspect of a source’s usefulness and credibility.', ['A source needs only one criterion to be reliable.', 'The three terms describe different media formats.', 'Checking all three guarantees that the source is unbiased.'], 1),
      q('A source is current and written by a qualified author, but it discusses a different topic. What is the best evaluation?', 'It may have authority and currency but lacks relevance to the research question.', ['It is relevant because it is recent.', 'It is automatically the best source available.', 'It should be used without checking its content.'], 0),
    ),
    lesson(
      q('What distinguishes disinformation from misinformation in the lesson?', 'Disinformation is deliberately created or shared to deceive; misinformation may be shared without that intent.', ['Disinformation is always printed, while misinformation is always broadcast.', 'Misinformation is accurate, while disinformation is an opinion.', 'Disinformation is a mistake, while misinformation is always intentional.'], 2),
      q('What does misinformation mean?', 'False or inaccurate information shared without necessarily intending to deceive.', ['Information supported by evidence and references.', 'A message that is deliberately accurate.', 'Any opinion that appears in a news report.'], 1),
      q('Someone forwards a false claim believing it is true. Which conclusion best fits the lesson?', 'The message can be misinformation even without an intent to deceive.', ['It cannot be false if the sender believes it.', 'It is automatically disinformation because it was forwarded.', 'It becomes reliable once several people share it.'], 3),
      q('Why can a misleading headline or edited image distort a claim?', 'It can alter how audiences understand information or remove its original context.', ['It always adds reliable evidence to the original claim.', 'It changes a false claim into a verified fact.', 'It prevents audiences from seeing any media message.'], 0),
      q('Before sharing a surprising online claim, what is the most responsible action?', 'Check the original context and seek credible supporting information.', ['Forward it immediately so others can decide.', 'Rely on the image without checking where it came from.', 'Treat a large number of shares as proof.'], 1),
    ),
    lesson(
      q('What does responsible digital citizenship emphasize?', 'Responsible and respectful behavior when using technology.', ['Posting as often as possible to build an audience.', 'Using online spaces without considering other people.', 'Deleting every record of online activity.'], 0),
      q('What is a digital footprint?', 'Information and traces a person leaves through online activities.', ['A printed record of the size of a device.', 'A password that is shared by a whole class.', 'A list of websites that have no user activity.'], 3),
      q('A student posts a comment and later deletes it. What should the student remember?', 'Online activity may still leave traces that form part of a digital footprint.', ['Deleting a post guarantees that no trace ever existed.', 'Only photos contribute to a digital footprint.', 'A digital footprint is created only by adults.'], 2),
      q('How are respectful communication and digital citizenship related?', 'Respectful conduct is one way to act responsibly in digital spaces.', ['Respect is unrelated to technology use.', 'Digital citizenship means avoiding all communication.', 'A person is responsible only when using school devices.'], 1),
      q('A classmate shares a personal detail in a group chat. What response best follows responsible online behavior?', 'Avoid spreading it further and communicate respectfully.', ['Repost it publicly to increase awareness.', 'Add unverified details to make the story clearer.', 'Use the information to embarrass the classmate.'], 0),
    ),
    lesson(
      q('How can media bias affect a report?', 'It can influence which information is selected or how it is presented.', ['It proves that every detail in the report is false.', 'It removes the need to evaluate evidence.', 'It guarantees that the report contains no facts.'], 2),
      q('What does objectivity generally aim for in reporting?', 'A fair presentation that distinguishes evidence from personal opinion.', ['A presentation that hides all relevant context.', 'A report that includes only one side’s preferred claims.', 'A style that uses emotional wording instead of evidence.'], 1),
      q('A report includes verified facts but emphasizes only one perspective. What can a reader infer?', 'The selection or framing may show bias even if some facts are accurate.', ['Every fact must be fabricated.', 'The report is objective because it contains facts.', 'Bias can occur only in false reports.'], 3),
      q('Why does the lesson say bias does not mean every part of a report is false?', 'Bias concerns selection or presentation and does not by itself invalidate each factual claim.', ['Bias proves all reports contain the same information.', 'A biased report cannot contain evidence.', 'Objectivity means that a report has no perspective at all.'], 0),
      q('When reading a report about a contested issue, what is a sound evaluation practice?', 'Compare its evidence, framing, and perspectives with other credible coverage.', ['Accept the first viewpoint because it is presented confidently.', 'Ignore the source and judge only its headline.', 'Assume every perspective is equally supported.'], 2),
    ),
    lesson(
      q('What is a central principle of information ethics?', 'Use information honestly, responsibly, and carefully.', ['Copy any material that is easy to access.', 'Present another person’s idea as one’s own.', 'Share personal information without considering its effects.'], 3),
      q('What should a student do when using another source’s ideas?', 'Acknowledge the source appropriately.', ['Remove the author’s name to make the idea easier to read.', 'Change a few words and claim the idea as original.', 'Cite only sources that agree with the report.'], 1),
      q('A student paraphrases a source but provides no credit. What is the key ethical issue?', 'The source’s idea still needs acknowledgment even when reworded.', ['Paraphrasing makes attribution unnecessary.', 'Only direct quotations need a source.', 'The idea becomes public knowledge after one rewrite.'], 2),
      q('Why are honesty and attribution connected in information use?', 'Attribution makes clear which ideas came from other creators.', ['Attribution guarantees that a source is correct.', 'Honesty requires copying the full source verbatim.', 'A citation replaces the need to understand the material.'], 0),
      q('A group uses a researcher’s explanation in a presentation. Which action best follows the lesson?', 'Identify the original source and represent its ideas accurately.', ['Remove the source to make the group appear more knowledgeable.', 'Claim the explanation as the group’s own discovery.', 'Use the explanation but change its meaning to fit the slides.'], 1),
    ),
    lesson(
      q('What does copyright generally provide for original creative works?', 'Legal protection for the work and its creator’s rights.', ['Automatic permission for anyone to redistribute the work.', 'A guarantee that the work is factually correct.', 'A requirement that every work be sold commercially.'], 2),
      q('What is plagiarism?', 'Presenting another person’s words or ideas without proper acknowledgment.', ['Using a work with permission and giving attribution.', 'Creating an original work from one’s own ideas.', 'Checking a source before deciding whether to cite it.'], 0),
      q('A student finds a photograph online. What can be inferred about copying it?', 'Online access alone does not mean the photograph is free to copy or redistribute.', ['Every online image is automatically public domain.', 'The image may be copied if the student changes its size.', 'Copyright applies only to printed photographs.'], 3),
      q('How does proper attribution relate to plagiarism?', 'Attribution credits the original creator and helps avoid presenting their work as one’s own.', ['Attribution removes copyright protection.', 'Attribution means a student can ignore permission requirements.', 'Plagiarism is prevented only by using no sources.'], 1),
      q('A student wants to include a video clip in a project. What should the student do?', 'Check the rights or permitted use and credit the creator as required.', ['Assume that streaming access grants redistribution rights.', 'Remove the creator’s name from the clip.', 'Use it without checking because the project is for school.'], 2),
    ),
    lesson(
      q('What is the main purpose of advertising?', 'To promote products, services, ideas, or organizations to an audience.', ['To provide a neutral account of every public issue.', 'To replace all forms of news and education.', 'To guarantee that audiences will purchase a product.'], 1),
      q('What does a persuasive technique in an advertisement try to do?', 'Influence how an audience thinks or acts.', ['Prevent an audience from noticing the message.', 'Remove the advertiser’s purpose from the message.', 'Ensure that every claim is independently verified.'], 3),
      q('An advertisement highlights a product’s benefits but says little about limitations. What should an audience infer?', 'The message is designed to persuade, so its claims should be evaluated carefully.', ['The product must have no limitations.', 'Advertising is not allowed to present selected information.', 'The benefits are proven because they appear in an ad.'], 0),
      q('Why can advertisements appear in many different media?', 'Advertisers use different channels to reach audiences with persuasive messages.', ['Only digital media can promote an idea.', 'The message becomes non-persuasive when its medium changes.', 'Media formats prevent advertisements from reaching people.'], 2),
      q('Which response best evaluates an advertisement’s product claim?', 'Look for supporting evidence and consider the persuasive purpose of the message.', ['Accept the claim because the design is attractive.', 'Assume the claim is true if it is repeated often.', 'Ignore all context and focus only on the slogan.'], 1),
    ),
  ],
  UCSP: [
    lesson(
      q('Which description best captures culture in the lesson?', 'A shared way of life that includes beliefs, values, practices, traditions, and behaviors.', ['A set of traits determined only by a person’s biology.', 'A collection of laws created only by government.', 'A list of objects that people own individually.'], 1),
      q('How is culture learned?', 'Through social interaction and participation in a community.', ['Only through formal examinations.', 'By inheriting every belief biologically.', 'By avoiding interaction with other people.'], 0),
      q('A child learns a greeting by observing family members use it. What can be inferred?', 'The child is learning a cultural practice through social interaction.', ['The greeting is a physical trait inherited at birth.', 'The child is forming a political institution.', 'The greeting cannot be part of culture unless written down.'], 3),
      q('Why can culture influence how people communicate?', 'Shared meanings and practices shape how people interpret and express messages.', ['Culture prevents people from learning language.', 'Communication is unrelated to shared ways of life.', 'Every community assigns identical meaning to every behavior.'], 2),
      q('A researcher studies a community’s traditions and daily practices. What should the researcher consider?', 'These practices may express shared beliefs and ways of life.', ['Every practice must be explained by individual preference alone.', 'Culture can be understood without observing social interaction.', 'Traditions have no connection to community meanings.'], 1),
    ),
    lesson(
      q('How do cultural elements such as symbols, language, and values function?', 'They communicate meanings and influence how people understand and organize life.', ['They prevent cultural knowledge from being shared.', 'They are all physical objects with no shared meaning.', 'They matter only when written into law.'], 2),
      q('What is a symbol in the lesson?', 'Something that communicates a shared idea, meaning, or identity.', ['A rule that applies only to economic exchange.', 'A biological characteristic shared by every person.', 'A private object that cannot represent anything.'], 0),
      q('A community uses a particular color to represent a shared identity. What can be inferred?', 'The color functions as a symbol because the community associates meaning with it.', ['The color is a value because it measures importance.', 'The color is language only if it is spoken aloud.', 'The color has no cultural meaning unless it is a law.'], 1),
      q('What role does language play in culture?', 'It allows people to communicate and pass cultural knowledge between people.', ['It eliminates the need for social interaction.', 'It affects only written records, not communication.', 'It makes shared values impossible to express.'], 3),
      q('A student compares how values and symbols affect a community. Which distinction is supported?', 'Values shape what people consider important, while symbols communicate shared meanings.', ['Values are always objects, while symbols are always spoken rules.', 'Both terms mean exactly the same thing.', 'Symbols determine biological traits, while values determine language.'], 2),
    ),
    lesson(
      q('What is one source of cultural differences discussed in the lesson?', 'History, geography, environment, and social experiences can shape differences.', ['Differences arise only from personal choice.', 'All cultural differences are caused by media technology.', 'Cultural differences disappear whenever people interact.'], 0),
      q('What does cultural diversity refer to?', 'The presence of different cultural groups and backgrounds in a society.', ['A society in which everyone has identical experiences.', 'A system that ranks people by occupation.', 'The absence of shared practices within groups.'], 3),
      q('Two groups develop different practices in response to different local environments. What can be inferred?', 'Environment can contribute to cultural differences.', ['The groups cannot belong to the same society.', 'One group’s practices must be incorrect.', 'Geography has no relationship to social experience.'], 1),
      q('Why should social differences be understood in context?', 'People’s experiences and practices can be shaped by history, environment, and social conditions.', ['Context makes all differences disappear.', 'A person’s background never affects daily experience.', 'Only individual personality explains cultural diversity.'], 2),
      q('When discussing different cultural practices, which approach best reflects the lesson?', 'Consider the group’s history and context before judging the practice.', ['Assume that one group’s practice is the standard for everyone.', 'Treat difference as evidence that a group lacks culture.', 'Ignore the experiences that shaped each practice.'], 0),
    ),
    lesson(
      q('What makes a social group a group?', 'Relationships, interaction, or shared interests connect its members.', ['Its members must all have the same occupation.', 'It must be created by a government law.', 'Its members must live in one household.'], 2),
      q('What is a society?', 'A network of people, relationships, institutions, and patterns of interaction.', ['A single organization with one purpose.', 'A place where people have no shared relationships.', 'A list of unrelated individuals.'], 1),
      q('A student belongs to a family, a school club, and a sports team. What does this illustrate?', 'A person can belong to multiple social groups at the same time.', ['Social groups cannot overlap.', 'Only family counts as a social group.', 'Membership ends when a person joins a new group.'], 3),
      q('How do social groups relate to society?', 'Groups are part of the relationships and interactions through which society is organized.', ['Groups exist outside all social relationships.', 'Society consists only of formal government institutions.', 'Groups prevent people from interacting.'], 0),
      q('To understand how a club influences its members, what should an observer examine?', 'The members’ interactions, shared interests, and relationships.', ['Only the club’s name and meeting room.', 'Whether each member has the same family.', 'The individual members without considering their group.'], 1),
    ),
    lesson(
      q('What does socialization teach people?', 'How to participate in society and interact within social life.', ['How to avoid all cultural learning.', 'How to inherit social status biologically.', 'How to remove institutions from society.'], 1),
      q('What is enculturation?', 'Learning and developing an understanding of one’s culture.', ['A process that ranks people by income.', 'A formal election for public office.', 'The creation of a written constitution.'], 3),
      q('A child learns family expectations and community customs at home. What can be inferred?', 'Family can act as an early agent of socialization and cultural learning.', ['Family has no role in learning behavior.', 'The child is learning only through biological inheritance.', 'Community customs cannot be learned in a household.'], 0),
      q('How are socialization and enculturation related but distinct?', 'Socialization concerns learning to participate in society; enculturation focuses on learning one’s culture.', ['They both refer only to voting in elections.', 'Enculturation replaces all forms of social interaction.', 'Socialization means learning language, while enculturation means learning biology.'], 2),
      q('A school teaches students shared rules for group participation. Which concept does this illustrate?', 'Socialization, because students are learning how to participate in society.', ['Social stratification, because the school ranks all families.', 'Political authority, because students make national laws.', 'Cultural diversity, because all rules are different.'], 1),
    ),
    lesson(
      q('What does social stratification describe?', 'The organization of people or groups into different social levels.', ['The way a society distributes rainfall.', 'The process by which a person learns a language.', 'The formation of social groups around one interest.'], 3),
      q('What is social inequality?', 'Unequal access to resources, opportunities, or advantages.', ['A difference in personal hobbies.', 'The equal distribution of every social resource.', 'A shared cultural tradition.'], 0),
      q('If education and wealth influence people’s social positions, what can be inferred?', 'Social status can be shaped by several social and economic factors.', ['Social status is determined only by age.', 'Education cannot affect social position.', 'Every person has exactly the same access to resources.'], 2),
      q('Why are stratification and inequality related?', 'Social levels can be associated with unequal access to resources and opportunities.', ['Both terms refer only to cultural symbols.', 'Stratification guarantees equal advantages.', 'Inequality exists only within a single family.'], 1),
      q('A community wants to examine unequal access to educational opportunities. Which approach fits the lesson?', 'Study how social conditions and status relate to access and advantage.', ['Treat differences in access as unrelated to society.', 'Assume resources are equal because schools exist.', 'Measure only the number of social groups.'], 0),
    ),
    lesson(
      q('What role do social institutions play?', 'They help organize society and address important social needs.', ['They replace all relationships between people.', 'They exist only to provide entertainment.', 'They prevent society from responding to shared needs.'], 0),
      q('Which is listed as a common social institution?', 'Education.', ['A temporary weather pattern.', 'A personal preference.', 'An isolated online comment.'], 2),
      q('A community relies on schools to support learning. What can be inferred?', 'Education is an institution serving a social function.', ['A school is not connected to social life.', 'Learning can only occur within families.', 'Institutions cannot address community needs.'], 1),
      q('Why are family, government, economy, and religion grouped as institutions?', 'They organize parts of social life and serve different functions.', ['They are all informal social groups with identical purposes.', 'They exist only when their members live together.', 'They share one role: enforcing school rules.'], 3),
      q('To understand an institution’s contribution, what should a student examine?', 'The social need it addresses and the function it serves.', ['Only its physical building.', 'Whether it has the largest membership.', 'Its relationship to an unrelated natural process.'], 2),
    ),
    lesson(
      q('What does politics involve?', 'Collective decision-making and addressing shared concerns.', ['Only campaigning for an individual’s private goals.', 'Avoiding decisions that affect a community.', 'The study of cultural symbols alone.'], 1),
      q('What is power in the lesson?', 'The ability to influence decisions, behavior, or outcomes.', ['A written record of cultural traditions.', 'The recognized right to make decisions.', 'An institution that provides education.'], 0),
      q('A community representative influences which local services receive attention. What can be inferred?', 'The representative is exercising power by influencing decisions.', ['The representative has no influence unless every person agrees.', 'The example describes enculturation only.', 'The decision is not political because it affects a community.'], 3),
      q('How does political authority differ from power?', 'Authority is a recognized right to make and implement decisions; power is the ability to influence.', ['Authority means wealth, while power means education.', 'Power is always recognized by law, while authority is never recognized.', 'The terms refer to unrelated natural processes.'], 2),
      q('A group is discussing a shared community concern. What action best reflects politics as described?', 'Participate in collective discussion and decision-making.', ['Keep the concern private so no decision is made.', 'Focus only on one person’s unrelated preference.', 'Assume that influence and authority are identical.'], 1),
    ),
    lesson(
      q('What does citizenship involve?', 'Rights, responsibilities, and participation in a political community.', ['Only living in a particular geographic area.', 'Membership in a private social club.', 'Avoiding all public concerns.'], 3),
      q('Which is an example of political participation?', 'Taking part in a community discussion about a public concern.', ['Reading a novel alone.', 'Choosing a personal hobby.', 'Using a symbol without communicating its meaning.'], 1),
      q('A citizen joins a community consultation but does not hold public office. What can be inferred?', 'Participation can occur through informal as well as formal forms.', ['Only elected officials can participate politically.', 'Citizenship does not include responsibilities.', 'A consultation is not connected to shared concerns.'], 0),
      q('Why does the lesson connect citizens’ rights with responsibilities?', 'Citizenship includes both protections under law and duties within the political community.', ['Rights eliminate the need for participation.', 'Responsibilities apply only to government employees.', 'The terms describe a person’s cultural background.'], 2),
      q('Which response best demonstrates active citizenship around a local issue?', 'Learn about the issue and participate through an appropriate civic channel.', ['Ignore information and rely only on rumor.', 'Assume a person has no role unless they hold office.', 'Share private information instead of addressing the public concern.'], 3),
    ),
    lesson(
      q('Why should Philippine society be understood through its cultural diversity?', 'Different cultures and experiences shape social relationships and community life.', ['All communities share exactly the same practices.', 'Culture has no influence on social relationships.', 'Political and social conditions are unrelated to people’s lives.'], 2),
      q('What can social conditions influence?', 'People’s experiences and opportunities.', ['Only the weather in a community.', 'The biological structure of every person.', 'Whether cultural practices exist.'], 1),
      q('Two communities have different local practices shaped by their histories. What can be inferred?', 'Regional experiences can contribute to the diversity of Philippine society.', ['One community must be outside Philippine society.', 'History cannot influence culture.', 'Different practices prevent social relationships.'], 0),
      q('How are culture, society, and politics connected in the Philippine context?', 'Cultural values and social conditions can shape relationships, community practices, and opportunities.', ['They are separate topics with no effect on daily life.', 'Politics determines every cultural practice in the same way.', 'Society consists only of government offices.'], 3),
      q('When comparing experiences across Philippine communities, what is the fairest approach?', 'Consider local history, cultural practices, and social conditions.', ['Assume one community represents every other community.', 'Ignore differences and treat all experiences as identical.', 'Explain every difference as an individual choice only.'], 1),
    ),
  ],
  CPAR: [
    lesson(
      q('What is a central purpose of contemporary Philippine art?', 'It reflects present-day Filipino experiences, ideas, cultures, and perspectives.', ['It records only events from distant history.', 'It uses one fixed medium and excludes technology.', 'It avoids personal or community experiences.'], 2),
      q('In this lesson, what does contemporary generally refer to?', 'Art connected to the current period and people’s present-day experiences.', ['Art made only with digital devices.', 'Art created exclusively for museums.', 'Art that uses no cultural references.'], 0),
      q('An artist makes a digital work using patterns from a hometown tradition. What can be inferred?', 'A contemporary medium can present regional cultural elements.', ['Digital tools prevent artists from expressing culture.', 'Traditional patterns make the work historical rather than contemporary.', 'A work can use only one artistic influence.'], 3),
      q('What does combining traditional elements with a modern medium demonstrate?', 'Artists can connect cultural heritage with present-day forms of expression.', ['Traditional elements lose all meaning in contemporary work.', 'Technology can be used only for entertainment.', 'Contemporary art must reject familiar materials.'], 1),
      q('When interpreting a contemporary artwork, which approach best follows the lesson?', 'Consider the artist’s experiences, cultural context, and chosen medium.', ['Judge it only by whether it looks traditional.', 'Assume every Filipino artist has the same perspective.', 'Ignore the materials and ideas used.'], 2),
    ),
    lesson(
      q('Which set of features may characterize contemporary art?', 'Experimentation, current themes, mixed media, and varied cultural contexts.', ['One required material and one fixed style.', 'Only realistic painting and sculpture.', 'Avoidance of technology and current experiences.'], 1),
      q('What is mixed media in contemporary art?', 'Combining different materials or art forms in one artwork.', ['Using only one traditional material.', 'Displaying an artwork without any audience.', 'Copying a work into several identical prints.'], 3),
      q('An artist combines video, sculpture, and sound to address a current concern. What can be inferred?', 'The artwork uses mixed media and engages with a present-day issue.', ['The artwork cannot be contemporary because it uses sculpture.', 'The artist must be presenting objective news.', 'Combining media prevents an artwork from communicating ideas.'], 0),
      q('Why can viewers interpret the same contemporary artwork differently?', 'Meaning can depend on the artwork’s context and the audience’s background.', ['Every artwork has no intended meaning.', 'The materials alone determine one universal interpretation.', 'Only the artist’s age determines the meaning.'], 2),
      q('A viewer wants to evaluate an installation made from recycled objects. What should the viewer consider?', 'Its material choices, intended message, and connection to the issue it addresses.', ['Whether all art must use new materials.', 'Whether the installation resembles a traditional portrait.', 'The number of people who have already seen it.'], 1),
    ),
    lesson(
      q('What can studying contemporary Filipino artists and their works help students understand?', 'How artistic choices can reflect identity, experience, culture, and society.', ['Why all artists use the same medium.', 'Why an artwork can be understood without any context.', 'How art is separate from communities and lived experience.'], 0),
      q('What is an artistic medium?', 'The materials or form an artist uses to communicate an idea.', ['The location where an audience sits.', 'The artist’s income from selling work.', 'A list of rules that every artist must follow.'], 2),
      q('A filmmaker uses movement, sound, dialogue, and editing to tell a story. What can be inferred?', 'The chosen medium shapes how the idea is communicated.', ['Film communicates only through still images.', 'The artist’s background cannot affect creative choices.', 'A story can be understood only through painting.'], 3),
      q('Why can learning about an artist’s background help interpret an artwork?', 'Experiences and context may explain the subjects and choices in the work.', ['Background replaces the need to look at the artwork.', 'An artist’s background always determines one fixed meaning.', 'Context matters only when the work is digital.'], 1),
      q('When comparing two artists inspired by different communities, what is a fair evaluation?', 'Recognize that their different experiences can produce diverse perspectives.', ['Rank one perspective as authentic and the other as invalid.', 'Assume both works communicate identical ideas.', 'Ignore the artists’ chosen forms and contexts.'], 0),
    ),
    lesson(
      q('What makes visual art distinct among artistic forms?', 'It is primarily experienced through sight and uses visual elements to communicate.', ['It can be experienced only through spoken language.', 'It must include live movement and music.', 'It excludes images, forms, and spatial arrangements.'], 3),
      q('Which is an element visual artists may use?', 'Texture.', ['Subduction.', 'Enculturation.', 'Homeostasis.'], 1),
      q('An artist arranges color, line, and space to guide how viewers look at a work. What can be inferred?', 'Visual elements help shape the audience’s experience and interpretation.', ['Visual elements matter only in digital art.', 'The work communicates without making any artistic choices.', 'Space and color are unrelated to visual expression.'], 0),
      q('Why can both a painting and a digital illustration be visual arts?', 'Both use visual forms to present artistic ideas, even though their tools differ.', ['Visual art requires paint and canvas.', 'Digital tools turn images into performing arts.', 'Only artworks displayed in galleries count as visual art.'], 2),
      q('A student evaluates a regional artwork using color, shape, texture, and form. What approach is the student applying?', 'Examining visual elements that contribute to the artwork’s expression.', ['Measuring the artist’s popularity.', 'Classifying the artwork by its price.', 'Assuming that the work has no cultural context.'], 3),
    ),
    lesson(
      q('What do the performing arts share?', 'They communicate through performance, often involving movement, sound, or action.', ['They are experienced only by reading printed text.', 'They must be created using digital animation.', 'They have no connection to audiences.'], 2),
      q('Which is a major form of performing art named in the lesson?', 'Theater.', ['Mineralogy.', 'Taxonomy.', 'Printmaking.'], 0),
      q('A stage performance combines local music, movement, and a story. What can be inferred?', 'A performance can communicate cultural experiences through several artistic elements.', ['The story cannot express culture if it includes movement.', 'Only written descriptions can communicate ideas.', 'Combining art forms prevents an audience from interpreting a work.'], 1),
      q('Why is the audience part of understanding a performance?', 'The work is presented through actions and expression experienced by viewers or listeners.', ['An audience determines the performer’s cultural identity.', 'A performance exists only after it is written down.', 'Audiences make music and movement unnecessary.'], 3),
      q('A student compares theater and dance as contemporary Philippine arts. What should the student examine?', 'How each form uses performance to communicate stories, emotions, or ideas.', ['Whether both use the same stage design.', 'Which form has the larger audience.', 'Whether one form can be separated from cultural experience.'], 2),
    ),
    lesson(
      q('What is central to literary and written arts?', 'Written or spoken language used as a major form of artistic expression.', ['The use of stone and metal without language.', 'The use of body movement alone.', 'The recording of sound without words or meaning.'], 1),
      q('Which is a form of literary art listed in the lesson?', 'Creative nonfiction.', ['Plate tectonics.', 'Broadcast journalism only.', 'Cellular respiration.'], 3),
      q('A writer uses imagery and symbolism to communicate an experience. What can be inferred?', 'Language techniques can add meaning beyond a text’s literal statements.', ['Literary art cannot communicate emotion.', 'Symbolism is used only in visual art.', 'Readers should ignore the writer’s language choices.'], 0),
      q('How can characters and imagery contribute to a literary work?', 'They help develop ideas, experiences, and meaning through language.', ['They replace language with physical materials.', 'They guarantee every reader will interpret a work identically.', 'They are unrelated to artistic expression.'], 2),
      q('When evaluating a poem about a community, what is a useful reading approach?', 'Consider its language, imagery, context, and the ideas it communicates.', ['Count its lines and assume that reveals its full meaning.', 'Treat every phrase as a factual report.', 'Ignore the writer’s use of symbols and images.'], 1),
    ),
    lesson(
      q('How can music function in contemporary Philippine arts?', 'As a form of cultural expression that can reflect community experiences and identity.', ['Only as background with no artistic meaning.', 'As a form that cannot combine traditional and contemporary influences.', 'Only as a written record of scientific information.'], 0),
      q('What can traditional music reflect according to the lesson?', 'The history, practices, and cultural identity of Filipino communities.', ['Only the equipment used to record a song.', 'The same experiences in every region.', 'A community’s weather without any cultural meaning.'], 2),
      q('A contemporary song incorporates a community’s traditional musical practice. What can be inferred?', 'Music can connect cultural heritage with present-day artistic expression.', ['Traditional music cannot influence contemporary work.', 'The song ceases to be music when it uses a new style.', 'Cultural identity can be expressed only through dance.'], 3),
      q('Why might different musical forms communicate different experiences?', 'Communities and artists use varied sounds and practices to express their contexts.', ['Every musical form has identical history and meaning.', 'Music has no relationship to culture.', 'Only lyrics can communicate an experience.'], 1),
      q('A student analyzes music from a local community. Which evaluation is most appropriate?', 'Listen for how musical choices relate to the community’s practices and context.', ['Assume the music represents every Filipino community.', 'Judge only by whether it uses electronic instruments.', 'Separate the music from any cultural background.'], 0),
    ),
    lesson(
      q('Which elements can dance use to communicate artistically?', 'Body movement, space, rhythm, timing, and expression.', ['Chemical composition, density, and streak.', 'Written citations and publication dates.', 'Only spoken dialogue and printed images.'], 2),
      q('What does rhythm contribute to dance?', 'A pattern of timing that helps organize movement.', ['A legal right to reproduce choreography.', 'A type of mineral found in rocks.', 'A method of ranking social groups.'], 3),
      q('A dance uses movements and timing associated with a community tradition. What can be inferred?', 'Movement can express cultural history and identity.', ['Dance cannot communicate without written words.', 'Traditional movement is unrelated to community experience.', 'The performance must be a visual art only.'], 1),
      q('Why does the lesson include space and expression alongside movement?', 'Dance communicates through how bodies move and use space with timing and expression.', ['Space and expression are not part of performance.', 'Movement alone gives every dance the same meaning.', 'Timing is used only in music, never dance.'], 0),
      q('When interpreting a contemporary dance inspired by a traditional form, what should a viewer consider?', 'How movement choices connect with cultural context and the artist’s expression.', ['Whether the dance exactly copies every earlier performance.', 'Only the stage size and costume color.', 'Whether the work contains a written paragraph.'], 2),
    ),
    lesson(
      q('What distinguishes digital art?', 'Digital technology is part of its creation or presentation.', ['It must be made only with physical clay.', 'It excludes all images and sounds.', 'It can be presented only as a live stage performance.'], 0),
      q('What is multimedia art?', 'Art that combines forms such as images, sound, text, animation, or video.', ['Art that uses exactly one material and one medium.', 'A printed work that cannot include any images.', 'A live performance without any artistic elements.'], 3),
      q('An artwork combines animation, text, and recorded sound. What can be inferred?', 'It uses multiple media and can be described as multimedia art.', ['It is not art because it includes text.', 'It must be a traditional painting.', 'Combining media removes the role of technology.'], 1),
      q('Why can interactive media be included in digital and multimedia arts?', 'Digital tools can let audiences engage with an artwork in different ways.', ['Interaction prevents an artwork from having an audience.', 'Digital art includes only static photographs.', 'Technology cannot be part of artistic creation.'], 2),
      q('A student evaluates a video artwork that combines images, sound, and animation. What should the student examine?', 'How the combined media and digital tools support the artwork’s expression.', ['Only the video’s file size.', 'Whether it could be recreated as a single printed sentence.', 'The assumption that technology determines the artwork’s meaning by itself.'], 0),
    ),
    lesson(
      q('How can local and regional context influence contemporary Philippine art?', 'Local histories, environments, languages, traditions, and communities can shape artistic expression.', ['It prevents artists from using contemporary techniques.', 'It makes all regional artworks identical.', 'It removes cultural meaning from an artwork.'], 3),
      q('What is regional context in the lesson?', 'The local cultural, historical, environmental, and community conditions surrounding artistic expression.', ['The exact price at which an artwork is sold.', 'A requirement that every artist use the same materials.', 'A type of digital file format.'], 1),
      q('An artist draws on a local story and presents it through a modern installation. What can be inferred?', 'Contemporary art can reinterpret local traditions through new forms.', ['A modern medium cannot carry a local story.', 'The story no longer has cultural context.', 'Regional art must avoid present-day experiences.'], 2),
      q('Why might artworks from different Philippine regions express different perspectives?', 'Artists may draw on distinct local histories, languages, environments, and practices.', ['All regions have identical artistic traditions.', 'Regional context changes only the artwork’s title.', 'Differences occur only because of audience size.'], 0),
      q('When presenting an artwork inspired by a local tradition, what is a responsible interpretation?', 'Explain the relevant community context and avoid treating one local practice as universal.', ['Assume the work represents every region in the Philippines.', 'Remove the community context to make the work seem modern.', 'Invent meanings that are not supported by the artwork or its context.'], 2),
    ),
  ],
  ELS: [
    lesson(
      q('What does Earth and Life Science study together?', 'Earth’s physical systems and materials together with the living organisms that depend on and interact with them.', ['Only the bodies of living organisms.', 'Only the weather and landforms of Earth.', 'The history of human inventions without environmental context.'], 1),
      q('What is the geosphere?', 'The solid parts of Earth, including its rocks, soil, and landforms.', ['All living organisms and places where life exists.', 'The gases that surround Earth.', 'Earth’s water in oceans, rivers, and ice.'], 2),
      q('Rainfall changes soil moisture, which affects plant growth and organisms that depend on plants. What can be inferred?', 'A change in one Earth system can influence other systems and living things.', ['Earth’s systems operate independently.', 'Plants depend only on sunlight and not their environment.', 'Rainfall is part of the biosphere.'], 0),
      q('Why does studying a plant’s growth involve both Earth Science and Life Science?', 'Life Science explains plant processes, while Earth Science explains environmental conditions and resources.', ['Both fields study only the plant’s cells.', 'Earth Science explains reproduction, while Life Science studies rocks.', 'The two fields cannot be used to study the same example.'], 3),
      q('To understand an environmental concern, which approach best follows the lesson?', 'Examine how physical Earth systems and living organisms interact.', ['Study organisms without considering their surroundings.', 'Consider only the human activity and ignore environmental effects.', 'Treat water, air, land, and life as unrelated topics.'], 1),
    ),
    lesson(
      q('What explains the formation of Earth’s major internal layers?', 'Early materials separated according to properties and densities as Earth developed.', ['The layers were added by living organisms.', 'Earth’s surface cooled into four identical solid shells.', 'The atmosphere compressed rocks into the planet’s center.'], 2),
      q('Which layer is Earth’s thin, solid outer layer?', 'The crust.', ['The outer core.', 'The inner core.', 'The lower atmosphere.'], 0),
      q('A sample comes from the central part of Earth and is described as mainly solid iron and nickel. Which layer does this fit?', 'The inner core.', ['The mantle.', 'The crust.', 'The hydrosphere.'], 1),
      q('What is the relationship between the outer and inner core described in the lesson?', 'The outer core is mainly liquid iron and nickel, while the inner core is mainly solid iron and nickel.', ['Both are made mainly of liquid water.', 'The inner core is liquid and the outer core is solid rock.', 'The outer core forms Earth’s thin surface layer.'], 3),
      q('Which explanation best connects Earth’s internal structure to surface change?', 'Slow movement of hot mantle material can contribute to tectonic plate movement and geological processes.', ['The crust never changes after it forms.', 'The core directly produces rainfall at Earth’s surface.', 'Earth’s layers have no connection to geological activity.'], 0),
    ),
    lesson(
      q('What does plate tectonics explain?', 'The slow movement and interaction of tectonic plates and their effects on Earth’s surface.', ['The daily movement of clouds around Earth.', 'The classification of minerals by color.', 'How organisms maintain internal temperature.'], 1),
      q('What is the asthenosphere in the lesson?', 'A softer, more flexible upper-mantle layer beneath the lithosphere.', ['The solid inner core of Earth.', 'The water layer surrounding continents.', 'A boundary where two plates always collide.'], 3),
      q('Two plates move horizontally past each other and stress builds along their boundary. What can be inferred?', 'The boundary is transform, and released stress can produce an earthquake.', ['It is divergent, so new crust must form between them.', 'It is convergent, so one plate must be forced beneath the other.', 'It is a weathering process unrelated to plate motion.'], 0),
      q('What can happen where two plates move apart?', 'Magma may rise, cool, and form new crust at a divergent boundary.', ['One plate must always form a deep trench by subduction.', 'The plates slide horizontally and release transform stress.', 'The movement directly changes a rock into a mineral.'], 2),
      q('A student observes a deep ocean trench near a convergent boundary. Which interpretation is supported?', 'Subduction may occur as one plate moves beneath another.', ['The plates are moving apart and creating a mid-ocean ridge.', 'The plates are sliding horizontally past each other.', 'The trench formed through biological classification.'], 3),
    ),
    lesson(
      q('How are minerals and rocks related?', 'Minerals are basic components of many rocks, while rocks are solid materials made of minerals or similar materials.', ['Rocks are single atoms, while minerals are living organisms.', 'Every rock is one pure mineral with no variation.', 'Minerals form only after rocks are melted by humans.'], 2),
      q('Which property is used to help identify a mineral?', 'Streak.', ['Lesson number.', 'Social status.', 'Trophic level.'], 0),
      q('Lava cools and solidifies at Earth’s surface. What kind of rock can form?', 'An extrusive igneous rock.', ['A sedimentary rock formed by cemented sediments.', 'A metamorphic rock formed without melting.', 'A mineral formed by organism classification.'], 1),
      q('Limestone changes into marble under heat and pressure without completely melting. What does this illustrate?', 'Metamorphic change of an existing rock.', ['Sediment deposition and cementation.', 'Cooling of lava into an igneous rock.', 'Physical weathering without any change to the rock.'], 3),
      q('A student is identifying a rock made of compacted and cemented sediments. Which classification is most appropriate?', 'Sedimentary, because sediments accumulated and became compacted and cemented.', ['Igneous, because all rocks begin as lava at the surface.', 'Metamorphic, because the rock must have completely melted.', 'Mineral, because every solid material is a mineral.'], 2),
    ),
    lesson(
      q('How are weathering and erosion different?', 'Weathering breaks down or alters rock in place, while erosion moves material to another location.', ['Weathering transports sediments, while erosion changes minerals chemically.', 'Both terms mean that rocks melt beneath Earth.', 'Erosion forms minerals, while weathering forms living cells.'], 1),
      q('What is deposition?', 'The settling of transported material in a new location.', ['The chemical alteration of minerals inside a rock.', 'The movement of tectonic plates past one another.', 'The cooling of magma beneath Earth’s surface.'], 3),
      q('A rock breaks into smaller pieces after repeated temperature changes, but its composition stays the same. What process is this?', 'Physical weathering.', ['Chemical weathering.', 'Deposition.', 'Metamorphism.'], 0),
      q('Flowing water carries weathered particles downstream, then the particles settle as the water slows. Which sequence is shown?', 'Erosion followed by deposition.', ['Deposition followed by melting.', 'Chemical weathering followed by plate subduction.', 'Metamorphism followed by biological reproduction.'], 2),
      q('A learner traces a rock from breakdown to transport, deposition, and later rock formation. Which idea should guide the explanation?', 'The rock cycle connects processes through which rocks form and change over time.', ['Each rock type remains unchanged forever.', 'Weathering and erosion are identical processes.', 'Only living organisms can transform rocks.'], 1),
    ),
    lesson(
      q('What do the atmosphere, hydrosphere, geosphere, and biosphere represent?', 'Interconnected Earth systems that exchange materials and influence one another.', ['Four names for the planet’s internal rock layers.', 'Independent zones that do not interact.', 'Four types of living organisms.'], 3),
      q('Which system includes Earth’s water in its different forms and locations?', 'The hydrosphere.', ['The geosphere.', 'The atmosphere.', 'The biosphere.'], 0),
      q('Water vapor condenses, falls as precipitation, and enters soil and rivers used by plants. What can be inferred?', 'The water cycle connects the atmosphere, hydrosphere, geosphere, and biosphere.', ['Only the atmosphere is involved in the process.', 'Living organisms do not interact with water.', 'The geosphere includes only the air above Earth.'], 2),
      q('How does weathering connect Earth’s systems?', 'Water and air can contribute to rock breakdown in the geosphere.', ['Weathering moves organisms into the atmosphere.', 'Weathering occurs only inside the biosphere.', 'Weathering prevents water from interacting with rocks.'], 1),
      q('A change in water availability affects plants and animals in a habitat. What is the best evaluation?', 'A change in one Earth system can influence living organisms and other systems.', ['Earth systems operate separately, so no effect is possible.', 'Only the biosphere can affect the hydrosphere.', 'The change matters only if the atmosphere disappears.'], 3),
    ),
    lesson(
      q('Which group of processes is used in the lesson to describe living organisms?', 'Cellular organization, energy use, growth, reproduction, response, and internal regulation.', ['Rock formation, erosion, deposition, and melting.', 'Voting, authority, citizenship, and government.', 'Only movement and the ability to see.'], 2),
      q('What is homeostasis?', 'The maintenance of relatively stable internal conditions.', ['The process of classifying organisms by name.', 'The movement of sediments by water.', 'The production of new crust at a plate boundary.'], 0),
      q('A person sweats when their body becomes too warm. What can be inferred?', 'Sweating is a response that helps maintain a relatively stable internal temperature.', ['Sweating is a form of reproduction.', 'The body has stopped using energy.', 'Homeostasis means the surroundings never change.'], 1),
      q('Why is metabolism associated with life processes?', 'Metabolism is the collection of chemical reactions through which organisms use energy and materials.', ['Metabolism describes the structure of Earth’s mantle.', 'Metabolism means that organisms do not need energy.', 'Metabolism is the name for an organism’s habitat.'], 3),
      q('Which observation best supports that an organism responds to stimuli?', 'A plant grows toward a source of light.', ['A rock is transported by a river.', 'A mineral has a visible streak.', 'A cloud forms from condensed water vapor.'], 0),
    ),
    lesson(
      q('What is the basic structural and functional unit of life?', 'The cell.', ['The ecosystem.', 'The mineral.', 'The tectonic plate.'], 2),
      q('Which structure regulates the movement of substances into and out of a cell?', 'The cell membrane.', ['The cell wall alone.', 'The ribosome.', 'The central vacuole only.'], 1),
      q('A cell has no membrane-bound nucleus. How is it classified?', 'As a prokaryotic cell.', ['As a eukaryotic cell.', 'As a plant organ.', 'As a multicellular tissue.'], 0),
      q('Why do mitochondria and ribosomes have different roles?', 'Mitochondria are involved in cellular respiration, while ribosomes are involved in protein synthesis.', ['Mitochondria store genetic material, while ribosomes regulate water.', 'Ribosomes carry out photosynthesis, while mitochondria make cell walls.', 'Both structures perform the same function in every cell.'], 3),
      q('A student observes a plant cell with chloroplasts, a cell wall, and a large central vacuole. What is the best interpretation?', 'These structures are features of plant cells that support photosynthesis, shape, and storage.', ['The cell must be prokaryotic because it has a cell wall.', 'The structures mean that plant cells lack a cell membrane.', 'The vacuole is the site of protein synthesis.'], 1),
    ),
    lesson(
      q('What does biodiversity include?', 'Variation within species, variety of species, and variety of ecosystems.', ['Only the number of animals in one habitat.', 'Only genetic differences between unrelated species.', 'The classification names used by scientists.'], 1),
      q('What is taxonomy?', 'The branch of biology concerned with naming, describing, and classifying organisms.', ['The movement of water through Earth’s systems.', 'The study of social groups and institutions.', 'The process of changing a rock through heat and pressure.'], 0),
      q('A forest has many kinds of organisms and differences among individuals of the same species. Which inference is supported?', 'The forest can show both species diversity and genetic diversity.', ['Only ecosystem diversity can exist in a forest.', 'Classification removes biodiversity from an area.', 'Genetic diversity means that the forest has no species.'], 2),
      q('Why do scientists use a hierarchical classification system?', 'It organizes organisms into increasingly specific groups based on characteristics and relationships.', ['It arranges organisms by how useful they are to humans.', 'It guarantees that organisms in one group look identical.', 'It replaces the need for scientific names.'], 3),
      q('A conservation project protects a forest habitat and prevents wildlife collection. Which lesson idea does this apply?', 'Conservation can help maintain organisms, habitats, and biodiversity.', ['Classification is the same as habitat destruction.', 'Biodiversity is protected by removing all species interactions.', 'Taxonomy requires that habitats remain unchanged.'], 1),
    ),
    lesson(
      q('What makes an ecosystem?', 'Living organisms interacting with one another and with nonliving environmental components.', ['A group of organisms without environmental conditions.', 'Only the soil and water in a location.', 'A food chain that contains producers but no consumers.'], 0),
      q('What is a biotic factor?', 'A living component of an ecosystem, such as a plant, animal, fungus, or microorganism.', ['A nonliving condition such as sunlight or soil.', 'A type of mineral in Earth’s crust.', 'A method of measuring energy use.'], 3),
      q('If decomposers break down dead organic matter, what can be inferred?', 'They help return nutrients to the environment.', ['They are producers that make food from sunlight.', 'They prevent nutrient cycling.', 'They obtain energy only by consuming sunlight directly.'], 1),
      q('How does energy movement differ from nutrient cycling in an ecosystem?', 'Energy moves through feeding relationships and some is released as heat, while nutrients can be recycled.', ['Energy is recycled indefinitely, while nutrients disappear at each level.', 'Both energy and nutrients move only from decomposers to producers.', 'Neither energy nor nutrients move among organisms.'], 2),
      q('A mangrove area is damaged by cutting and pollution. Which response best applies environmental sustainability?', 'Protect or restore the habitat and manage resources responsibly for future generations.', ['Use the remaining resources as quickly as possible.', 'Ignore effects on biodiversity if some organisms remain.', 'Remove producers so consumers have more space.'], 2),
    ),
  ],
};

function makeChoices(answer, distractors, correctIndex) {
  const choices = [...distractors];
  choices.splice(correctIndex, 0, answer);
  return choices;
}

const assessmentCatalog = Object.entries(lessonsBySubject).flatMap(([subjectCode, subjectLessons]) =>
  subjectLessons.flatMap((questions, lessonIndex) => questions.map((item, questionIndex) => ({
    subjectCode,
    lessonNumber: lessonIndex + 1,
    question: item.question,
    questionType: questionTypes[questionIndex],
    choices: makeChoices(item.answer, item.distractors, item.correctIndex),
    correctAnswer: item.correctIndex,
    explanation: `${explanationByType[questionTypes[questionIndex]]}: ${item.answer}`,
    points: 1,
    order: questionIndex + 1,
    isPublished: true,
  }))),
);

module.exports = { assessmentCatalog, questionTypes };
