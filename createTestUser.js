// Simple script to create a test user for CashFlowly
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cashflowly')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('Error:', err));

// User Schema (simplified)
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    phoneNumber: String,
    password: String,
    incomeLevel: String
});

const User = mongoose.model('User', userSchema);

async function createTestUser() {
    try {
        // Check if user exists
        const existingUser = await User.findOne({ email: 'test@test.com' });

        if (existingUser) {
            console.log('\n📋 EXISTING USER FOUND:');
            console.log('Email:', existingUser.email);
            console.log('Name:', existingUser.name);
            console.log('Phone:', existingUser.phoneNumber);
            console.log('\n⚠️  Note: Password is hashed, cannot display');
            console.log('\n💡 Suggested action: Try password "test123" or create new user with different email');
        } else {
            // Create new test user
            const hashedPassword = await bcrypt.hash('test123', 10);

            const testUser = new User({
                name: 'Test User',
                email: 'test@test.com',
                phoneNumber: '+254712345678',
                password: hashedPassword,
                incomeLevel: 'Middle'
            });

            await testUser.save();

            console.log('\n✅ TEST USER CREATED SUCCESSFULLY!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📧 Email: test@test.com');
            console.log('🔑 Password: test123');
            console.log('👤 Name: Test User');
            console.log('📱 Phone: +254712345678');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        // Show all users
        const allUsers = await User.find({}, 'email name phoneNumber');
        console.log('\n📊 ALL USERS IN DATABASE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        allUsers.forEach((user, i) => {
            console.log(`${i + 1}. ${user.email} - ${user.name}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

createTestUser();
