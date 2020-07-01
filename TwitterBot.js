const puppeteer = require('puppeteer')
const readWrite  = require('fs')

//returning values from promises is a  bit convoluted so we will simply set global variables instead of returning values
let username;
let password;
let alreadyAdded;
let inappropiateContent;
let quoteCounter = 10
let dailyQuote = ''
let sentDailyTweet;
let todaysDate = new Date()
todaysDate.setDate(1)

startTwitterBot()

async function startTwitterBot()
{
    
    const browser = await puppeteer.launch({headless: true})
    const page = await browser.newPage()
    
    try
    {
        await LogIn(page)
            
        while(true)
        {
            await sendDailyTweet(page)
            await page.waitFor(2000)
            await search(page, "depressed")
            await page.waitFor(2000)
            await RetweetAllWithHappyQuote(page)
            await waitToTweetAgain(page, 240) //4 hours           
        }
    }
    catch(e)
    {
        console.log('Error! Dying...')
        browser.close()
    }
}

async function waitToTweetAgain(page, amountInMinutes)
{
    for(let timePassed = 0; timePassed < amountInMinutes; timePassed++)
    {
        console.log(timePassed + ' minutes passed')
        await page.waitFor(60000) //1 minute
    }
}

async function grabCredsFromJson(page)
{
    let jsonCredentials

    readWrite.readFile('password.json', (error, credentials) => 
    {
        if(error) throw error

        jsonCredentials = JSON.parse(credentials)
    })

    await page.waitFor(1000)

    username = jsonCredentials[0].username
    password = jsonCredentials[0].password
}

async function RetweetAllWithHappyQuote(page)
{
    let counter = 0

    //we just need to use allTweets to prevent index out of bounds
    let allTweets = await page.$$('time')

    console.log(allTweets.length)

    for(let counter = 0; counter < allTweets.length && counter < 5; counter++)
    {
        console.log('counter: ' + counter)

        await TrackPeopleAlreadyTweeted(page, counter)
        await page.waitFor(2000)
        
        console.log('Already Added: ' + alreadyAdded)

        await page.waitFor(3000)

        if( !alreadyAdded && !inappropiateContent) 
        {
            await page.waitFor(1000)
            await page.click('div[aria-label="Reply"]')
            await page.waitFor(3000)

            await CheckIfInappropiate(page)
            console.log('Inappropiate Content: ' + inappropiateContent)
            await page.waitFor(2000)

            await RemoveAllUnwantedUsersFromThread(page)
            await page.type('div[aria-label="Tweet text"]', `${insertHappyQuote()}`, {delay: 25})
            await page.waitFor(1000)

            await page.click('div[data-testid="tweetButton"]')
            await page.waitFor(1000)
        }
        await page.waitFor(60000)
        await page.goBack()
        await page.waitFor(5000)
    }
}

async function CheckIfInappropiate(page)
{
    try
    {
        await page.click('div[class="css-18t94o4 css-1dbjc4n r-1niwhzg r-42olwf r-sdzlij r-1phboty r-rs99b7 r-1w2pmg r-1vsu8ta r-aj3cln r-1ny4l3l r-utggzx r-o7ynqc r-6416eg r-lrvibr"]')
        inappropiateContent = true
    }
    catch(e)
    {
        inappropiateContent = false
    }

    await page.waitFor(2000)
}

async function TrackPeopleAlreadyTweeted(page, counter)
{
    let tweets = await page.$$('time')
    console.log('Tweets Length: ' + tweets.length)
    await tweets[counter].click()
    await page.waitFor(3000)
    let tweetUrl = await page.url().toString()
    await page.waitFor(3000)
    // await page.goBack()

    if(tweetUrl.indexOf('status') == -1)
    {
        throw "We are on the wrong page!"
    }
    // we want to filter per user instead of per tweet
    let userUrl = tweetUrl.substring(0, tweetUrl.indexOf('status'))

    console.log(tweetUrl)
  
    readWrite.readFile('VisitedTweets.txt', (error, VisitedTweets) => 
    {
        if (error) throw err;

        console.log('Visited Tweets index: ' + VisitedTweets.indexOf(userUrl))
     
        if(VisitedTweets.indexOf(userUrl) != -1) 
        {
            //we have to write this hack because the variable couldnt be overriden inside of this if block
            alreadyAdded = true
        }
        else readWrite.writeFile('VisitedTweets.txt', `${tweetUrl}\n${VisitedTweets}`, (error) => 
        { 
            if (error) throw err;
            alreadyAdded = false 
        })     
    })   

}

async function LogIn(page)
{
    await grabCredsFromJson(page)
    await page.waitFor(1000)

    await page.goto(`https://twitter.com/login`, { waitUntil: 'networkidle2' })
    await page.waitFor(3000)
    await page.type('input[name="session[username_or_email]"]',`${username}`,{ delay: 25 })
    await page.waitFor(2000)
    await page.type('input[name="session[password]"]',`${password}`, { delay: 25 })
    await page.waitFor(2000)
    await page.click('div[data-testid="LoginForm_Login_Button"]')
    await page.waitFor(3000)
}

//we need this so we do not mention everyone in the thread and get flagged for spam
async function RemoveAllUnwantedUsersFromThread(page)
{
    await page.click('div[class="css-18t94o4 css-901oao r-1re7ezh r-16y2uox r-1qd0xha r-a023e6 r-16dba41 r-ad9z0x r-bcqeeo r-19yat4t r-glunga r-qvutc0"]')
    await page.waitFor(3000)
    let unwantedUsers = await page.$$('div[data-testid="UserCell"]')

    let users = unwantedUsers.length

    console.log("user count: " + users)

    //we start at one becuase the 0th index is the OP and the second index might be a box we do not want to click, so we may leave one user
    for(let count = 0; count < users; count++) {
        await unwantedUsers[count].click()
        await page.waitFor(2000)
    }

    await page.click('div[class="css-18t94o4 css-1dbjc4n r-urgr8i r-42olwf r-sdzlij r-1phboty r-rs99b7 r-1w2pmg r-1vsu8ta r-aj3cln r-1ny4l3l r-1fneopy r-o7ynqc r-6416eg r-lrvibr"')
    await page.waitFor(2000)
}

async function search(page, searchTerm)
{
    switch(searchTerm)
    {
        case "anxiety" : await page.goto(`https://twitter.com/search?q=%23anxiety&src=typed_query`, { waitUntil: 'networkidle2'}); break;
        case "depressed": await page.goto(`https://twitter.com/search?q=%22i%27m%20really%20depressed%22&src=typed_query&f=live`, { waitUntil: 'networkidle2'}); break;
        case "depressedMom": await page.goto(`https://twitter.com/search?q=%23depressedmom&src=typed_query&f=live`, { waitUntil: 'networkidle2'}); break;
    }

    await page.waitFor(5000)

}

async function sendDailyTweet(page)
{
    //this sets the sentdailytweet variable
    await dailyTweetSent()

    if(sentDailyTweet) { /*do nothing because we already tweeted*/ return }
    
    await page.waitFor(2000)
    await page.type('div[aria-label="Tweet text"]', `${dailyQuote}`, { delay: 25 }) 
    await page.waitFor(2000)
    await page.click('div[data-testid="tweetButtonInline"]')
    await page.waitFor(2000)    
}

async function dailyTweetSent()
{
    let now = new Date()
    if(now.getDate() != todaysDate.getDate())
    {
        todaysDate.setDate(now.getDate())
        dailyQuote = GetDailyTip()
        sentDailyTweet =  false
        return
    }
    sentDailyTweet = true
}

function insertHappyQuote()
{
    if(quoteCounter == 40) { quoteCounter = -1 } 
    quoteCounter = quoteCounter + 1
    switch(quoteCounter)
    {
        case 0: return "#HappyBot Reminder: You matter. I am so happy I get to share the world with you."
        case 1: return "Friendly Reminder: You're a gift to those around you."
        case 2: return "Remember, Even the things you don’t like about yourself are beautiful."
        case 3: return "You’re worthy of all the good things that will be coming to you."
        case 4: return "Friendly Reminder: You are so special to everyone you know."
        case 5: return "If you haven't heard this yet today, you matter and I'm proud of you."
        case 6: return "Don't forget, you are beautiful inside and out."
        case 7: return "Remember, you are worthy of love and respect."
        case 8: return "If you haven't heard this yet today, you’re a gift to everyone you meet."
        case 9: return "You deserve all of the happiness in the world."
        case 10: return "If you haven't heard this yet today, you deserve to be happy."
        case 11: return "Remember, you are appreciated."
        case 12: return "Friendly Reminder: You are loved and cherished."
        case 13: return "#HappyBot Reminder: You bring out the best in other people."
        case 14: return "You are loved and matter in the world."
        case 15: return "You are seeing this tweet because the universe cares about you and wants you to know you matter."
        case 16: return "#HappyBot Reminder: You’re amazing!"
        case 17: return "Friendly Reminder, you have positively effected more lives than you think."
        case 18: return "#HappyBot Reminder: You are the most perfect you there is."
        case 19: return "Friendly Reminder: You are an inspiration to others."
        case 20: return "#HappyBot Reminder: You have amazing creative potential."
        case 21: return "Don't forget, you're someone's reason to smile."
        case 22: return "#HappyBot Reminder: Everyone gets knocked down sometimes; only people like you get back up again and keep going."
        case 23: return "#HappyBot Reminder: You're important and matter in the world."
        case 24: return "Just stopping by to spread some joy, you deserve it."
        case 25: return "Just stopping by to spread some happiness, you deserve it."
        case 26: return "I am just here to remind you, you are loved and adored."
        case 27: return "If you're reading this, you're awesome and deserve happiness in your life."
        case 28: return "Do not forget, you have a beautiful soul."
        case 29: return "Just stopping by to say, I hope you enjoy the rest of your day."
        case 30: return "Never forget how amazing you are."
        case 31: return "Remember, you’re braver than you believe, and stronger than you seem, and smarter than you think."
        case 32: return "This message is to remind you that you are an amazing person."
        case 33: return "This message is to remind you that you are a great person."
        case 34: return "Never forget that you are loved."
        case 35: return "Never forget how amazing you are."
        case 36: return "Friendly Reminder: You're irreplacable."
        case 37: return "Gentle Reminder: You are a good person."
        case 38: return "Gentle Note: You are enough, just the way you are."
        case 39: return "Gentle Note: You are talented and intelligent."
        case 40: return "Gentle Reminder: I am proud of you."
        case 41: return "#HappyBot Reminder: Whatever challenges come your way, you can overcome them."
    }
}

function GetDailyTip()
{
    let getDayOfMonth = new Date()
    
    let dailyTweetCounter = getDayOfMonth.getDate() - 1

    switch(dailyTweetCounter)
    {
        case 0: return "#DailyHappinessReminder: Take the time to write down what you're grateful for each and every day."
        case 1: return "#DailyHappinessReminder: Don’t take rejection personally. At some point we all face rejection."
        case 2: return "#DailyHappinessReminder: Remember to travel. Traveling is a great way to get away from the daily grind, it also helps you appreciate what you have back at home."
        case 3: return "#DailyHappinessReminder: Don’t multitask too often. If you’re feeling constantly burnt out it’s probably because you’re doing too much at one time."
        case 4: return "#DailyHappinessReminder: Embrace a growth mindset. Thrive on challenge and see failure not as evidence of unintelligence but as a heartening springboard for growth and for stretching our existing abilities."
        case 5: return "#DailyHappinessReminder: Try not to hold grudges. It can mentally wear you out and makes you miserable. And doesn’t life seem to go a whole lot smoother when you’re not angry?"
        case 6: return "#DailyHappinessReminder: You can’t change the past and you have no control of the future. Live in the moment and enjoy what’s in front of you right here, right now."
        case 7: return "#DailyHappinessReminder: Everything we experience can be a bummer if we choose to see it that way. But when you search for the benefits or silver linings in your life, you may be surprised to discover a lot of good."
        case 8: return "#DailyHappinessReminder: Communicate kindly. When we are kind to others, we feel better about ourselves."
        case 9: return "#DailyHappinessReminder: When you find yourself thinking negatively, pause and refocus your thoughts. In time, your brain will be able to do this more easily on its own. "
        case 10: return "#DailyHappinessReminder: To become happier, try to gain clarity on your emotions; find out what you're feeling and what caused those feelings."
        case 11: return "#DailyHappinessReminder: Sure, sometimes life is hard. But by paying attention to the good, you can rise above it and be more resilient."
        case 12: return "#DailyHappinessReminder: We can use imagination to help create happiness out of thin air and enjoy our experiences more."
        case 13: return "#DailyHappinessReminder: The world seems dark and scary, but by practicing mindfulness we experience more fully both the positive and the negative — we are more fully engaged in our lives."
        case 14: return "#DailyHappinessReminder: We all define happiness in different ways. When you know what happiness means to you, you'll have an easier time finding it."
        case 15: return "#DailyHappinessReminder: Learning how to express yourself can help you overcome interpersonal challenges, which can make you unhappy."
        case 16: return "#DailyHappinessReminder: Explore exactly what gives you a sense of purpose and how you want to pursue this purpose to give your life a greater sense of meaning."
        case 17: return "#DailyHappinessReminder: Adequate sleep is a vital, trusted source to good health, brain function, and emotional well-being."
        case 18: return "#DailyHappinessReminder: Try using Positive Affiramtions - Positive Affirmations are short positive statements targeted at a specific set of negative beliefs. When practiced regularly, a positive affirmation can help to make long-term changes to the ways that you think and feel."
        case 19: return "#DailyHappinessReminder: Spend More Time With Friends/Family: Money Can't Buy You Happiness."
        case 20: return "#DailyHappinessReminder: Making time to go outside on a nice day also delivers a huge happiness advantage."
        case 21: return "#DailyHappinessReminder: To make yourself feel happier, you should help others."
        case 22: return "#DailyHappinessReminder: Smiling can make us feel better, but it's more effective when we back it up with positive thoughts."
        case 23: return "#DailyHappinessReminder: Meditate: Rewire Your Brain for Happiness."
        case 24: return "#DailyHappinessReminder: To boost your baseline-level happiness, you can try changing your physiology through nutrition and exercise."
        case 25: return "#DailyHappinessReminder: Deep breathing exercises can help reduce stress."
        case 26: return "#DailyHappinessReminder: Acknowledge the feeling of unhappiness, letting yourself experience it for a moment. Then, shift your focus toward what made you feel this way and what it might take to recover."
        case 27: return "#DailyHappinessReminder: A journal is a good way to organize your thoughts, analyze your feelings, and make plans."
        case 28: return "#DailyHappinessReminder: For those stressors you can’t avoid, remind yourself that everyone has stress — there’s no reason to think it’s all on you. And chances are, you’re stronger than you think you are."
        case 29: return "#DailyHappinessReminder: Try getting involved in a local volunteer group or taking a class. Both can help to connect you with like-minded people in your area. And chances are, they’re looking for friends, too."
        case 30: return "#DailyHappinessReminder: Let your mind wander free for a change. Read. Meditate. Take a walk and pay attention to your surroundings. Be sociable. Or be alone. Just be."
    }
}

