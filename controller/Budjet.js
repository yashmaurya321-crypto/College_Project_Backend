const User = require('../model/User');
const Budjet = require('../model/Budget');

const createBudjet = async (req, res) => {
  try {
    const { user, categories, startDate, endDate, limit } = req.body;

    // Check if user exists
    const userExists = await User.findById(user);
    if (!userExists) {
      return res.status(400).json({ message: "User not found" });
    }

    const newBudjet = new Budjet({
      user,
      categories,
      startDate,
      endDate,
      limit,
    });

    await newBudjet.save();
    res.status(201).json(newBudjet);
  } catch (err) {
    console.error('Error:', err);  // Log error details
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

  // Get all Budjets for a user
  const getBudjets = async (req, res) => {
    try {
      const userId = req.params.userId;
      const Budjets = await Budjet.find({ user: userId });
      
      if (!Budjets || Budjets.length === 0) {
        return res.status(404).json({ message: "No Budjets found" });
      }
  
      res.status(200).json(Budjets);
    } catch (err) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  };
  
  // Get a single Budjet by ID
  const getBudjetById = async (req, res) => {
    try {
      const BudjetId = req.params.id;
      const Budjet = await Budjet.findById(BudjetId);
      
      if (!Budjet) {
        return res.status(404).json({ message: "Budjet not found" });
      }
  
      res.status(200).json(Budjet);
    } catch (err) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  };
  
  // Update a Budjet by ID
  const updateBudjet = async (req, res) => {
    try {
      const BudjetId = req.params.id;
      const { categories, startDate, endDate } = req.body;
  
      const updatedBudjet = await Budjet.findByIdAndUpdate(
        BudjetId,
        { categories, startDate, endDate },
        { new: true } 
      );
  
      if (!updatedBudjet) {
        return res.status(404).json({ message: "Budjet not found" });
      }
  
      res.status(200).json(updatedBudjet);
    } catch (err) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  };
  
  const updateOrCreateCategory = async (req, res) => {
    try {
      const userId = req.params.userId; // Get the userId from the URL params
      const { name, category, limit, startDate, endDate } = req.body; // Get category details from the body
  
      // Validate input
      if ( !name || !category || !limit || !startDate || !endDate) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      // Find the budget by the userId
      const budget = await Budjet.findOne({ user: userId });
  
      if (!budget) {
        return res.status(404).json({ message: 'Budget not found for this user' });
      }
  
      // Check if the category already exists in the user's budget by categoryId
      const existingCategoryIndex = budget.categories.findIndex(
        (cat) => cat.name.toString() === name
      );
  
      if (existingCategoryIndex !== -1) {
        // Category exists, update it
        budget.categories[existingCategoryIndex] = {
          ...budget.categories[existingCategoryIndex],
          name,
          category,
          limit,
          startDate,
          endDate,
        };
  
        // Save the updated budget
        await budget.save();
  
        return res.status(200).json({ message: 'Category updated successfully', budget });
      } else {
        // Category does not exist, create it
        const newCategory = {
          name,
          category,
          limit,
          spent: 0, // Default spent is 0
          startDate,
          endDate,
        };
  
        // Add the new category to the budget
        budget.categories.push(newCategory);
  
        // Save the updated budget with the new category
        await budget.save();
  
        return res.status(201).json({ message: 'Category created successfully', budget });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server Error', error: err.message });
    }
  };
  
  // Delete a Budjet by ID
  const deleteBudjet = async (req, res) => {
    try {
      const BudjetId = req.params.id;
      const deletedBudjet = await Budjet.findByIdAndDelete(BudjetId);
  
      if (!deletedBudjet) {
        return res.status(404).json({ message: "Budjet not found" });
      }
  
      res.status(200).json({ message: "Budjet deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server Error", error: err.message });
    }
  };
  
  module.exports = {
    createBudjet,
    getBudjets,
    getBudjetById,
    updateBudjet,
    deleteBudjet,
    updateOrCreateCategory
  };